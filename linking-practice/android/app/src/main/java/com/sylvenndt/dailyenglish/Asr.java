package com.sylvenndt.dailyenglish;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 手机本地的英语语音识别：NVIDIA Parakeet TDT 0.6B v2（int8），用 sherpa-onnx 运行。
 * 模型打包在安装包的 assets/asr/ 里，不用下载、不用联网。
 * 最大的 encoder（650MB）在安装包里是 xz 压缩的（这样安装包不到 500MB）：第一次打开时在手机上解压一次到 App 自己的存储里，
 * 以后（包括以后覆盖安装新版）都直接用解压好的。App 一打开就在后台加载。
 */
final class Asr {
    static final String NAME = "Parakeet TDT 0.6B v2";
    private static final String TAG = "DshAsr";
    private static final String DIR = "asr/";

    /** 模型换了就改这个，手机上会重新解压 */
    private static final String MODEL_ID = "parakeet-tdt-0.6b-v2-int8";
    private static final String[] SMALL = {"decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"};
    private static volatile String state = "off"; // off | unpacking:百分比 | loading | ready | error:原因
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

    static boolean available(AssetManager am) {
        try {
            String[] f = am.list("asr");
            if (f == null) return false;
            boolean enc = false, tok = false;
            for (String s : f) { if (s.startsWith("encoder")) enc = true; if (s.equals("tokens.txt")) tok = true; }
            return enc && tok;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean hasAsset(AssetManager am, String name) {
        try (InputStream in = am.open(DIR + name)) { return true; } catch (IOException e) { return false; }
    }

    /** 安装包里是压缩的模型：解压到 files/asr/（只在第一次或换模型时做），返回目录；不需要解压返回 null */
    private static File unpack(Context ctx) throws IOException {
        AssetManager am = ctx.getAssets();
        if (!hasAsset(am, "encoder.int8.onnx.xz")) return null;
        File dir = new File(ctx.getFilesDir(), "asr");
        File ok = new File(dir, "READY-" + MODEL_ID);
        if (ok.exists() && new File(dir, "encoder.int8.onnx").isFile()) return dir;
        state = "unpacking:0";
        WebFiles.deleteTree(dir);
        if (!dir.mkdirs()) throw new IOException("建不了目录");
        long free = new StatFs(dir.getPath()).getAvailableBytes();
        if (free < 750L * 1024 * 1024) throw new IOException("手机存储空间不够：识别模型第一次要解压出约 700MB，现在只剩 " + (free >> 20) + "MB");
        for (String f : SMALL) {
            try (InputStream in = am.open(DIR + f); OutputStream o = new FileOutputStream(new File(dir, f))) { copy(in, o, -1, 0); }
        }
        long total = 0;
        try (InputStream in = am.open(DIR + "encoder.int8.onnx.size")) { total = Long.parseLong(new String(WebFiles.readAll(in)).trim()); } catch (Exception ignored) { }
        File tmp = new File(dir, "encoder.int8.onnx.part");
        final long tot = total;
        long t0 = System.currentTimeMillis();
        // 模型在安装包里没压缩存放（noCompress xz），可以直接拿到文件位置，几个线程同时解不同的块
        try (AssetFileDescriptor afd = am.openFd(DIR + "encoder.int8.onnx.xz");
             FileInputStream fin = new FileInputStream(afd.getFileDescriptor())) {
            int th = Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors()));
            Unxz.decompress(fin.getChannel(), afd.getStartOffset(), afd.getLength(), tmp, th,
                    d -> { if (tot > 0) state = "unpacking:" + Math.min(99, d * 100 / tot); });
        } catch (IOException e) {
            // 拿不到文件位置（被压缩了之类）：按流一个线程解
            try (InputStream raw = am.open(DIR + "encoder.int8.onnx.xz", AssetManager.ACCESS_STREAMING);
                 InputStream in = new XZInputStream(new BufferedInputStream(raw, 1 << 16));
                 OutputStream o = new FileOutputStream(tmp)) {
                copy(in, o, total, 1);
            }
        }
        unpackMs = System.currentTimeMillis() - t0;
        if (total > 0 && tmp.length() != total) throw new IOException("解压出来的模型大小不对（" + tmp.length() + " / " + total + "）");
        if (!tmp.renameTo(new File(dir, "encoder.int8.onnx"))) throw new IOException("改名失败");
        if (!ok.createNewFile()) throw new IOException("写标记失败");
        Log.i(TAG, "unpacked model to " + dir);
        return dir;
    }

    private static void copy(InputStream in, OutputStream o, long total, int report) throws IOException {
        byte[] b = new byte[1 << 17];
        long done = 0;
        int n, last = -1;
        while ((n = in.read(b)) > 0) {
            o.write(b, 0, n);
            done += n;
            if (report > 0 && total > 0) {
                int pct = (int) Math.min(99, done * 100 / total);
                if (pct != last) { last = pct; state = "unpacking:" + pct; }
            }
        }
    }

    /** 后台加载（重复调用没关系） */
    static void load(final Context ctx) {
        synchronized (lock) {
            if (!"off".equals(state) && !state.startsWith("error")) return;
            state = "loading";
        }
        pool.execute(() -> {
            long t0 = System.currentTimeMillis();
            try {
                File dir = unpack(ctx);
                state = "loading";
                // 解压过的从 App 存储里读，没压缩的直接从安装包里读
                String base = dir != null ? dir.getPath() + "/" : DIR;
                OfflineTransducerModelConfig t = new OfflineTransducerModelConfig();
                t.setEncoder(base + "encoder.int8.onnx");
                t.setDecoder(base + "decoder.int8.onnx");
                t.setJoiner(base + "joiner.int8.onnx");
                OfflineModelConfig m = new OfflineModelConfig();
                m.setTransducer(t);
                m.setTokens(base + "tokens.txt");
                m.setModelType("nemo_transducer");
                m.setNumThreads(Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors())));
                m.setProvider("cpu");
                m.setDebug(false);
                OfflineRecognizerConfig c = new OfflineRecognizerConfig();
                c.setModelConfig(m);
                c.setDecodingMethod("greedy_search");
                OfflineRecognizer r = new OfflineRecognizer(dir != null ? null : ctx.getAssets(), c);
                // 先空跑一次，第一次真正识别就不会慢
                decode(r, new float[Recorder.SR / 2]);
                rec = r;
                loadMs = System.currentTimeMillis() - t0;
                state = "ready";
                Log.i(TAG, "loaded in " + loadMs + "ms (unpack " + unpackMs + "ms)");
            } catch (Throwable e) {
                Log.e(TAG, "load failed", e);
                state = "error:" + e.getClass().getSimpleName() + (e.getMessage() != null ? " " + e.getMessage() : "");
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
