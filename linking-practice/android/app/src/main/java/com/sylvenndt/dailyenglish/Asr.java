package com.sylvenndt.dailyenglish;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.net.ConnectivityManager;
import android.os.Process;
import android.os.StatFs;
import android.util.Log;

import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineStream;
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig;

import org.json.JSONObject;
import org.tukaani.xz.XZInputStream;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 手机本地的英语语音识别：NVIDIA Parakeet TDT 0.6B v2（int8），用 sherpa-onnx 运行。
 *
 * 模型最大的部分 encoder 有 650MB，有三种来源（都只做一次，放进 App 自己的存储 files/asr/，以后覆盖安装新版也不用再来）：
 *   ① 安装包里直接带着（没压缩）：直接从安装包读；
 *   ② 完整版安装包里带着 xz 压缩的（约 410MB）：第一次打开在手机上解压；
 *   ③ 精简版安装包（能在聊天里直接发）不带：第一次打开下载一次（先 GitHub 上压缩的 410MB，不行再 Hugging Face 镜像），
 *      能断点续传，下完校验 SHA-256。用流量时先问用户，连 Wi-Fi 时自动下。
 * 解码器、联合网络、词表很小，所有版本都带着。
 */
final class Asr {
    static final String NAME = "Parakeet TDT 0.6B v2";
    private static final String TAG = "DshAsr";
    private static final String DIR = "asr/";

    /** 模型换了就改这个（还有下面的大小、SHA-256、下载地址），手机上会重新准备 */
    private static final String MODEL_ID = "parakeet-tdt-0.6b-v2-int8";
    private static final long ENC_SIZE = 652282309L;
    private static final String ENC_SHA256 = "92a10bd9c23936ea0566c29f963bc57c2a5df4261b6a8921c39abea66557ca8b";
    private static final String[] XZ_URLS = {
            "https://github.com/sylvenndt/Apps/releases/download/dailyenglish-model/encoder.int8.onnx.xz",
    };
    private static final String[] RAW_URLS = {
            "https://hf-mirror.com/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/resolve/main/encoder.int8.onnx",
            "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/resolve/main/encoder.int8.onnx",
    };
    private static final String[] SMALL = {"decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"};

    // off | need-download（等用户同意用流量下载）| download:百分比:MB/s:总MB | unpacking:百分比 | verifying | loading | ready | error:原因
    private static volatile String state = "off";
    private static volatile boolean consent = false;
    private static volatile OfflineRecognizer rec;
    private static volatile long loadMs = 0;
    private static volatile long unpackMs = 0;
    private static final Object lock = new Object();
    private static final ExecutorService pool = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(() -> { Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT); r.run(); }, "dsh-asr");
        return t;
    });
    private static final AtomicInteger seq = new AtomicInteger();
    private static final Map<Integer, String> jobs = new ConcurrentHashMap<>();

    static String state() { return state; }
    static long loadMs() { return loadMs; }
    static long unpackMs() { return unpackMs; }

    /** 安装包里有识别所需的文件（encoder 可以之后再下载） */
    static boolean available(AssetManager am) { return hasAsset(am, "tokens.txt"); }

    /** 安装包里有没有带 encoder（没压缩或压缩的） */
    static boolean bundled(AssetManager am) { return hasAsset(am, "encoder.int8.onnx") || hasAsset(am, "encoder.int8.onnx.xz"); }

    private static boolean hasAsset(AssetManager am, String name) {
        try (InputStream in = am.open(DIR + name)) { return true; } catch (IOException e) { return false; }
    }

    private static final class NeedConsent extends Exception { }

    /** 准备好模型文件，返回目录；安装包里有没压缩的 encoder 时返回 null（直接从安装包读） */
    private static File prepare(Context ctx) throws Exception {
        AssetManager am = ctx.getAssets();
        if (hasAsset(am, "encoder.int8.onnx")) return null;
        File dir = new File(ctx.getFilesDir(), "asr");
        File ok = new File(dir, "READY-" + MODEL_ID);
        File enc = new File(dir, "encoder.int8.onnx");
        if (ok.exists() && enc.isFile()) return dir;
        boolean fromXzAsset = hasAsset(am, "encoder.int8.onnx.xz");
        if (!fromXzAsset && !consent && metered(ctx)) throw new NeedConsent();
        // 换了模型：清掉旧的（保留下了一半的文件，可以续传）
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) if (f.getName().startsWith("READY-")) { WebFiles.deleteTree(dir); break; }
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("建不了目录");
        for (String f : SMALL) {
            try (InputStream in = am.open(DIR + f); OutputStream o = new FileOutputStream(new File(dir, f))) { copy(in, o); }
        }
        long free = new StatFs(dir.getPath()).getAvailableBytes();
        long need = fromXzAsset ? 700L << 20 : 1200L << 20;
        if (free < need) throw new IOException("手机存储空间不够：识别模型要占约 " + (need >> 20) + "MB，现在只剩 " + (free >> 20) + "MB");
        File part = new File(dir, "encoder.int8.onnx.part");
        long t0 = System.currentTimeMillis();
        if (fromXzAsset) {
            state = "unpacking:0";
            // 模型在安装包里没压缩存放（noCompress xz），可以直接拿到文件位置，几个线程同时解不同的块
            try (AssetFileDescriptor afd = am.openFd(DIR + "encoder.int8.onnx.xz");
                 FileInputStream fin = new FileInputStream(afd.getFileDescriptor())) {
                Unxz.decompress(fin.getChannel(), afd.getStartOffset(), afd.getLength(), part, threads(), Asr::unpackProgress);
            } catch (IOException e) {
                try (InputStream raw = am.open(DIR + "encoder.int8.onnx.xz", AssetManager.ACCESS_STREAMING);
                     InputStream in = new XZInputStream(new BufferedInputStream(raw, 1 << 16));
                     OutputStream o = new FileOutputStream(part)) { copy(in, o); }
            }
            if (part.length() != ENC_SIZE) throw new IOException("解压出来的模型大小不对（" + part.length() + "）");
        } else {
            fetch(dir, part);
        }
        unpackMs = System.currentTimeMillis() - t0;
        if (!part.renameTo(enc)) throw new IOException("改名失败");
        if (!ok.createNewFile()) throw new IOException("写标记失败");
        Log.i(TAG, "model ready in " + dir + " (" + unpackMs + "ms)");
        return dir;
    }

    private static int threads() { return Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors())); }

    private static void unpackProgress(long done) { state = "unpacking:" + Math.min(99, done * 100 / ENC_SIZE); }

    private static boolean metered(Context ctx) {
        try {
            ConnectivityManager cm = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
            return cm == null || cm.isActiveNetworkMetered();
        } catch (Exception e) { return true; }
    }

    /** 下载 encoder：先 GitHub 上 xz 压缩的（小三分之一），不行再下没压缩的；都能断点续传；最后核对 SHA-256 */
    private static void fetch(File dir, File part) throws IOException {
        StringBuilder why = new StringBuilder();
        File xz = new File(dir, "encoder.int8.onnx.xz.part");
        // 已经下了一半的没压缩版本：接着下它
        boolean rawFirst = part.isFile() && part.length() > 0 && !xz.isFile();
        for (int round = 0; round < 2; round++) {
            boolean raw = (round == 0) == rawFirst;
            String[] urls = raw ? RAW_URLS : XZ_URLS;
            for (String u : urls) {
                for (int attempt = 0; attempt < 3; attempt++) {
                    try {
                        if (raw) {
                            download(u, part, ENC_SIZE);
                        } else {
                            download(u, xz, -1);
                            state = "unpacking:0";
                            try (FileInputStream fin = new FileInputStream(xz)) {
                                Unxz.decompress(fin.getChannel(), 0, xz.length(), part, threads(), Asr::unpackProgress);
                            } catch (IOException e) {
                                // 压缩包坏了：两个都删掉，下一轮重新下
                                //noinspection ResultOfMethodCallIgnored
                                xz.delete();
                                //noinspection ResultOfMethodCallIgnored
                                part.delete();
                                throw new IOException("解压失败：" + e.getMessage());
                            }
                        }
                        state = "verifying";
                        if (part.length() != ENC_SIZE || !ENC_SHA256.equals(sha256(part))) {
                            //noinspection ResultOfMethodCallIgnored
                            part.delete();
                            if (!raw) { //noinspection ResultOfMethodCallIgnored
                                xz.delete(); }
                            throw new IOException("下载的文件校验不对");
                        }
                        //noinspection ResultOfMethodCallIgnored
                        xz.delete();
                        return;
                    } catch (IOException e) {
                        Log.w(TAG, "download " + u + " failed: " + e);
                        why.append(host(u)).append("：").append(e.getMessage()).append("；");
                        if (String.valueOf(e.getMessage()).startsWith("HTTP 4")) break; // 这个地址没有，换下一个
                        try { Thread.sleep(1500); } catch (InterruptedException ignored) { }
                    }
                }
            }
        }
        throw new IOException("识别模型下载失败（" + why + "）");
    }

    private static String host(String u) { try { return new URL(u).getHost(); } catch (Exception e) { return u; } }

    /** 下载到 part（已有的部分续传）；expected > 0 时核对总大小 */
    private static void download(String url, File part, long expected) throws IOException {
        long have = part.isFile() ? part.length() : 0;
        if (expected > 0 && have == expected) return;
        if (expected > 0 && have > expected) { //noinspection ResultOfMethodCallIgnored
            part.delete(); have = 0; }
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "DailyEnglish-Android");
        if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
        try {
            int code = c.getResponseCode();
            if (code == 416 && have > 0) { // 已经下完了
                if (expected <= 0 || have == expected) return;
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                throw new IOException("续传位置不对，重下");
            }
            if (code == 200) have = 0;
            else if (code != 206) throw new IOException("HTTP " + code);
            long len = c.getContentLengthLong();
            long total = len > 0 ? have + len : -1;
            if (expected > 0 && total > 0 && total != expected) throw new IOException("大小不对（" + total + "）");
            if (total <= 0) total = expected;
            byte[] buf = new byte[1 << 17];
            long done = have, mark = done, tMark = System.currentTimeMillis();
            double mbps = 0;
            try (InputStream in = c.getInputStream(); OutputStream o = new FileOutputStream(part, have > 0)) {
                int n;
                state = "download:" + pct(done, total) + ":0:" + (total > 0 ? total >> 20 : 0);
                while ((n = in.read(buf)) > 0) {
                    o.write(buf, 0, n);
                    done += n;
                    long now = System.currentTimeMillis();
                    if (now - tMark >= 1000) {
                        mbps = (done - mark) / 1048576.0 / ((now - tMark) / 1000.0);
                        mark = done; tMark = now;
                        state = "download:" + pct(done, total) + ":" + String.format(java.util.Locale.US, "%.1f", mbps) + ":" + (total > 0 ? total >> 20 : 0);
                    }
                }
            }
            if (total > 0 && done != total) throw new IOException("没下完（" + done + "/" + total + "）");
        } finally {
            c.disconnect();
        }
    }

    private static int pct(long done, long total) { return total > 0 ? (int) Math.min(99, done * 100 / total) : 0; }

    private static String sha256(File f) throws IOException {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new FileInputStream(f)) {
                byte[] b = new byte[1 << 17];
                int n;
                while ((n = in.read(b)) > 0) md.update(b, 0, n);
            }
            StringBuilder sb = new StringBuilder();
            for (byte x : md.digest()) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }

    private static void copy(InputStream in, OutputStream o) throws IOException {
        byte[] b = new byte[1 << 17];
        int n;
        while ((n = in.read(b)) > 0) o.write(b, 0, n);
    }

    /** 用户同意下载（用流量时要先问） */
    static void allowDownload(Context ctx) {
        consent = true;
        load(ctx);
    }

    /** 后台准备并加载模型（重复调用没关系） */
    static void load(final Context ctx) {
        synchronized (lock) {
            if (!"off".equals(state) && !state.startsWith("error") && !"need-download".equals(state)) return;
            state = "loading";
        }
        pool.execute(() -> {
            long t0 = System.currentTimeMillis();
            try {
                File dir;
                try { dir = prepare(ctx); }
                catch (NeedConsent nc) { state = "need-download"; return; }
                state = "loading";
                long t1 = System.currentTimeMillis();
                // 准备好的从 App 存储里读，没压缩的直接从安装包里读
                String base = dir != null ? dir.getPath() + "/" : DIR;
                OfflineTransducerModelConfig t = new OfflineTransducerModelConfig();
                t.setEncoder(base + "encoder.int8.onnx");
                t.setDecoder(base + "decoder.int8.onnx");
                t.setJoiner(base + "joiner.int8.onnx");
                OfflineModelConfig m = new OfflineModelConfig();
                m.setTransducer(t);
                m.setTokens(base + "tokens.txt");
                m.setModelType("nemo_transducer");
                m.setNumThreads(threads());
                m.setProvider("cpu");
                m.setDebug(false);
                OfflineRecognizerConfig c = new OfflineRecognizerConfig();
                c.setModelConfig(m);
                c.setDecodingMethod("greedy_search");
                OfflineRecognizer r = new OfflineRecognizer(dir != null ? null : ctx.getAssets(), c);
                // 先空跑一次，第一次真正识别就不会慢
                decode(r, new float[Recorder.SR / 2]);
                rec = r;
                loadMs = System.currentTimeMillis() - t1;
                state = "ready";
                Log.i(TAG, "loaded in " + loadMs + "ms (prepare " + (t1 - t0) + "ms)");
            } catch (Throwable e) {
                Log.e(TAG, "load failed", e);
                state = "error:" + (e instanceof IOException ? "" : e.getClass().getSimpleName() + " ") + (e.getMessage() != null ? e.getMessage() : "");
            }
        });
    }

    private static String decode(OfflineRecognizer r, float[] samples) {
        OfflineStream s = r.createStream();
        try {
            s.acceptWaveform(samples, Recorder.SR);
            r.decode(s);
            String t = r.getResult(s).getText();
            return t == null ? "" : t.trim();
        } finally {
            s.release();
        }
    }

    /** 交一段 16kHz 的声音去识别，返回任务号；用 job(id) 取结果 */
    static int submit(final Context ctx, final short[] pcm) {
        final int id = seq.incrementAndGet();
        jobs.put(id, "");
        if (rec == null) load(ctx);
        pool.execute(() -> {
            JSONObject o = new JSONObject();
            try {
                if (rec == null) throw new IllegalStateException(state.startsWith("error") ? state : "模型没加载起来");
                float[] f = new float[pcm.length];
                for (int i = 0; i < pcm.length; i++) f[i] = pcm[i] / 32768f;
                long t0 = System.currentTimeMillis();
                String text = decode(rec, f);
                o.put("text", text);
                o.put("ms", System.currentTimeMillis() - t0);
                o.put("sec", pcm.length / (double) Recorder.SR);
            } catch (Throwable e) {
                try { o.put("error", String.valueOf(e.getMessage() != null ? e.getMessage() : e)); } catch (Exception ignored) { }
            }
            jobs.put(id, o.toString());
        });
        return id;
    }

    /** 还没好返回 ""，好了返回 JSON（取过一次就删掉） */
    static String job(int id) {
        String v = jobs.get(id);
        if (v == null) return "{\"error\":\"没有这个任务\"}";
        if (!v.isEmpty()) jobs.remove(id);
        return v;
    }
}
