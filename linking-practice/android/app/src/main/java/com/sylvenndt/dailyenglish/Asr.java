package com.sylvenndt.dailyenglish;

import android.content.res.AssetManager;
import android.os.Process;
import android.util.Log;

import com.k2fsa.sherpa.onnx.OfflineModelConfig;
import com.k2fsa.sherpa.onnx.OfflineRecognizer;
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OfflineStream;
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig;

import org.json.JSONObject;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 手机本地的英语语音识别：NVIDIA Parakeet TDT 0.6B v2（int8），用 sherpa-onnx 运行。
 * 模型打包在安装包的 assets/asr/ 里，App 一打开就在后台加载，不用下载、不用联网。
 */
final class Asr {
    static final String NAME = "Parakeet TDT 0.6B v2";
    private static final String TAG = "DshAsr";
    private static final String DIR = "asr/";

    private static volatile String state = "off"; // off | loading | ready | error:原因
    private static volatile OfflineRecognizer rec;
    private static volatile long loadMs = 0;
    private static final Object lock = new Object();
    private static final ExecutorService pool = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(() -> { Process.setThreadPriority(Process.THREAD_PRIORITY_DEFAULT); r.run(); }, "dsh-asr");
        return t;
    });
    private static final AtomicInteger seq = new AtomicInteger();
    private static final Map<Integer, String> jobs = new ConcurrentHashMap<>();

    static String state() { return state; }
    static long loadMs() { return loadMs; }

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

    /** 后台加载（重复调用没关系） */
    static void load(final AssetManager am) {
        synchronized (lock) {
            if (!"off".equals(state) && !state.startsWith("error")) return;
            state = "loading";
        }
        pool.execute(() -> {
            long t0 = System.currentTimeMillis();
            try {
                OfflineTransducerModelConfig t = new OfflineTransducerModelConfig();
                t.setEncoder(DIR + "encoder.int8.onnx");
                t.setDecoder(DIR + "decoder.int8.onnx");
                t.setJoiner(DIR + "joiner.int8.onnx");
                OfflineModelConfig m = new OfflineModelConfig();
                m.setTransducer(t);
                m.setTokens(DIR + "tokens.txt");
                m.setModelType("nemo_transducer");
                m.setNumThreads(Math.max(2, Math.min(4, Runtime.getRuntime().availableProcessors())));
                m.setProvider("cpu");
                m.setDebug(false);
                OfflineRecognizerConfig c = new OfflineRecognizerConfig();
                c.setModelConfig(m);
                c.setDecodingMethod("greedy_search");
                OfflineRecognizer r = new OfflineRecognizer(am, c);
                // 先空跑一次，第一次真正识别就不会慢
                decode(r, new float[Recorder.SR / 2]);
                rec = r;
                loadMs = System.currentTimeMillis() - t0;
                state = "ready";
                Log.i(TAG, "loaded in " + loadMs + "ms");
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
    static int submit(final AssetManager am, final short[] pcm) {
        final int id = seq.incrementAndGet();
        jobs.put(id, "");
        if (rec == null) load(am);
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
