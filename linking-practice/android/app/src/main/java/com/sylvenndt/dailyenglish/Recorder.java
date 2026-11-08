package com.sylvenndt.dailyenglish;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

/**
 * 原生录音（16kHz 单声道 16 位）。WebView 的 getUserMedia 在部分机型上打不开麦克风，所以 App 里一律用这个。
 * 说完停顿一会儿自动结束；一直没开口也会自动结束。
 *
 * 状态：idle → rec → done；出错时是 error:原因（perm 没权限 / init 麦克风初始化失败 / busy 被占用 / read 读不到声音）。
 */
final class Recorder {
    static final int SR = 16000;
    private static final int FRAME = 800; // 50ms 一帧

    private volatile String state = "idle";
    private volatile int level = 0;
    private volatile boolean speech = false;
    private volatile AudioRecord mic;
    private volatile Thread thread;
    private short[] pcm = new short[SR * 30];
    private int len = 0;
    private int gen = 0;

    String state() { return state; }
    int level() { return level; }
    boolean speech() { return speech; }

    /** 录好的声音（只在 done 之后读）；拷一份出去 */
    synchronized short[] samples() {
        short[] out = new short[len];
        System.arraycopy(pcm, 0, out, 0, len);
        return out;
    }

    synchronized void reset() {
        stopMic();
        gen++;
        state = "idle"; level = 0; speech = false; len = 0;
    }

    /** 立刻开始录音，返回是否开起来了（失败原因在 state 里） */
    synchronized boolean start(int maxMs, int silenceMs, int waitMs) {
        stopMic();
        gen++;
        final int myGen = gen;
        len = 0; level = 0; speech = false;
        AudioRecord r = open(MediaRecorder.AudioSource.VOICE_RECOGNITION);
        if (r == null) r = open(MediaRecorder.AudioSource.MIC);
        if (r == null) { state = "error:init"; return false; }
        try {
            r.startRecording();
        } catch (Exception e) {
            release(r);
            state = "error:busy";
            return false;
        }
        if (r.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            release(r);
            state = "error:busy";
            return false;
        }
        mic = r;
        state = "rec";
        final AudioRecord rec = r;
        final int maxT = Math.max(1500, Math.min(maxMs, 60000));
        final int silT = Math.max(600, Math.min(silenceMs, 6000));
        final int waitT = Math.max(2000, Math.min(waitMs, 30000));
        Thread t = new Thread(() -> loop(rec, myGen, maxT, silT, waitT), "dsh-rec");
        t.setPriority(Thread.MAX_PRIORITY);
        thread = t;
        t.start();
        return true;
    }

    private static AudioRecord open(int source) {
        try {
            int min = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) min = 3200;
            AudioRecord r = new AudioRecord(source, SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min * 2, SR * 2));
            if (r.getState() != AudioRecord.STATE_INITIALIZED) { release(r); return null; }
            return r;
        } catch (SecurityException e) {
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private void loop(AudioRecord r, int myGen, int maxMs, int silenceMs, int waitMs) {
        short[] f = new short[FRAME];
        long t0 = System.currentTimeMillis(), lastLoud = 0;
        double noiseMin = Double.MAX_VALUE, thr = 600;
        boolean thrSet = false;
        int loud = 0, errors = 0, frames = 0;
        String end = "done";
        while (true) {
            synchronized (this) { if (gen != myGen || !"rec".equals(state)) return; }
            int n;
            try { n = r.read(f, 0, FRAME); } catch (Exception e) { n = -1; }
            if (n <= 0) {
                if (++errors > 20) { end = frames == 0 ? "error:read" : "done"; break; }
                try { Thread.sleep(10); } catch (InterruptedException ignored) { }
                continue;
            }
            errors = 0; frames++;
            double s = 0;
            for (int i = 0; i < n; i++) s += (double) f[i] * f[i];
            double rms = Math.sqrt(s / n);
            synchronized (this) {
                if (gen != myGen) return;
                if (len + n > pcm.length) {
                    short[] b = new short[Math.max(pcm.length * 2, len + n)];
                    System.arraycopy(pcm, 0, b, 0, len);
                    pcm = b;
                }
                System.arraycopy(f, 0, pcm, len, n);
                len += n;
            }
            level = (int) rms;
            long now = System.currentTimeMillis(), el = now - t0;
            // 先听 0.3 秒环境噪音，定一个「在说话」的门槛
            if (el < 300) { noiseMin = Math.min(noiseMin, rms); continue; }
            if (!thrSet) {
                thrSet = true;
                if (noiseMin == Double.MAX_VALUE) noiseMin = 150;
                thr = Math.max(330, Math.min(1300, noiseMin * 3));
            }
            if (rms > thr) { if (++loud >= 2) { speech = true; } lastLoud = now; } else loud = 0;
            if (speech && now - lastLoud > silenceMs) break;
            if (!speech && el > waitMs) break;
            if (el > maxMs) break;
        }
        synchronized (this) {
            if (gen != myGen) return;
            stopMic();
            state = end;
        }
    }

    /** 用户点了「说完了」 */
    synchronized void finish() {
        if ("rec".equals(state)) {
            gen++; // 让录音线程退出
            stopMic();
            state = "done";
        }
    }

    private void stopMic() {
        AudioRecord r = mic;
        mic = null;
        release(r);
    }

    private static void release(AudioRecord r) {
        if (r == null) return;
        try { r.stop(); } catch (Exception ignored) { }
        try { r.release(); } catch (Exception ignored) { }
    }
}
