package com.sylvenndt.dailyenglish;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.Toast;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Locale;

/**
 * 每日美语（外壳 3）。页面在 WebView 里，下面几样由安卓原生来做，通过 JS 接口给页面用：
 *   DSHREC  录音（原生 AudioRecord，比 WebView 的 getUserMedia 稳）
 *   DSHASR  语音识别（内置 Parakeet 模型，手机本地运行）
 *   DSHTTS  手机自带的英文朗读
 *   DSHAPP  版本、在线更新、复制到剪贴板、打开外部链接
 */
public class MainActivity extends Activity {
    private static final String TAG = "DshMain";
    private static final int REQ_MIC = 7;
    private static final int REQ_FILE = 8;

    private WebView wv;
    private WebFiles web;
    private TextToSpeech tts;
    private volatile boolean ttsReady = false;
    private final Recorder recorder = new Recorder();
    private PermissionRequest pendingPerm;
    private ValueCallback<Uri[]> fileCb;
    private SharedPreferences prefs;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private long lastUpdateCheck = 0;
    private boolean pageLoadedOnce = false;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("dsh", MODE_PRIVATE);
        web = new WebFiles(this);
        initTts();

        WebView.setWebContentsDebuggingEnabled(true);
        wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setTextZoom(100);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return web.handle(req.getUrl(), req.getMethod());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (u != null && WebFiles.HOST.equals(u.getHost())) return false;
                openExternal(u);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!pageLoadedOnce && url != null && url.startsWith(WebFiles.ORIGIN)) {
                    pageLoadedOnce = true;
                    // 页面起来以后再去后台加载识别模型和检查新版页面，不跟页面抢资源
                    ui.postDelayed(() -> Asr.load(getAssets()), 800);
                    ui.postDelayed(MainActivity.this::checkUpdate, 4000);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req != null && req.isForMainFrame()) showError(String.valueOf(err.getDescription()));
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // 页面进程被系统回收了：重建页面，不要整个 App 闪退
                Log.w(TAG, "renderer gone, recreating");
                try { ((android.view.ViewGroup) view.getParent()).removeView(view); } catch (Exception ignored) { }
                try { view.destroy(); } catch (Exception ignored) { }
                wv = null;
                recreate();
                return true;
            }
        });

        // 页面以后如果再用 Service Worker，它的请求也走同一套本地文件
        if (Build.VERSION.SDK_INT >= 24) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                        return web.handle(req.getUrl(), req.getMethod());
                    }
                });
            } catch (Exception ignored) { }
        }

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                ui.post(() -> {
                    if (hasMic()) r.grant(r.getResources());
                    else { pendingPerm = r; askMic(); }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    Intent i = p.createIntent();
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    startActivityForResult(Intent.createChooser(i, "选一个录音文件"), REQ_FILE);
                    return true;
                } catch (Exception e) {
                    fileCb = null;
                    cb.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "打不开文件选择", Toast.LENGTH_SHORT).show();
                    return true;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Log.w("DshPage", m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        wv.addJavascriptInterface(new TtsBridge(), "DSHTTS");
        wv.addJavascriptInterface(new RecBridge(), "DSHREC");
        wv.addJavascriptInterface(new AsrBridge(), "DSHASR");
        wv.addJavascriptInterface(new AppBridge(), "DSHAPP");

        setContentView(wv);
        if (!hasMic() && !prefs.getBoolean("micAsked", false)) askMic();
        wv.loadUrl(WebFiles.START);
    }

    /* ---------------- 朗读 ---------------- */
    private void initTts() {
        tts = new TextToSpeech(this, st -> {
            if (st != TextToSpeech.SUCCESS || tts == null) return;
            int r = tts.setLanguage(Locale.US);
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) tts.setLanguage(Locale.ENGLISH);
            tts.setSpeechRate(0.95f);
            tts.setPitch(1.0f);
            ttsReady = true;
        });
    }

    final class TtsBridge {
        @JavascriptInterface
        public void speak(final String text, final float rate) {
            ui.post(() -> {
                if (tts == null || !ttsReady || text == null || text.trim().isEmpty()) return;
                tts.setSpeechRate(Math.max(0.4f, Math.min(1.6f, rate * 0.95f)));
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "dsh" + System.nanoTime());
            });
        }
        @JavascriptInterface public void stop() { ui.post(() -> { if (tts != null) tts.stop(); }); }
        @JavascriptInterface public boolean ready() { return ttsReady; }
    }

    /* ---------------- 麦克风 ---------------- */
    private boolean hasMic() {
        return checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private void askMic() {
        prefs.edit().putBoolean("micAsked", true).apply();
        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
    }

    /** granted 已允许 / prompt 还没问过 / denied 拒绝过（还能再问）/ blocked 拒绝且不再询问（只能去系统设置打开） */
    private String permState() {
        if (hasMic()) return "granted";
        // 还没拒绝过（包括系统弹窗正在显示）：可以直接问
        if (!prefs.getBoolean("micDenied", false)) return "prompt";
        // 拒绝过一次还能再问；拒绝两次后系统就不再弹窗了
        return shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) ? "denied" : "blocked";
    }

    final class RecBridge {
        /** 有没有录音权限（旧接口名，保留） */
        @JavascriptInterface public boolean ready() { return hasMic(); }
        @JavascriptInterface public boolean hasPerm() { return hasMic(); }
        @JavascriptInterface public String permState() { return MainActivity.this.permState(); }
        @JavascriptInterface public void ask() { ui.post(MainActivity.this::askMic); }
        @JavascriptInterface public void settings() { ui.post(MainActivity.this::openAppSettings); }

        /** 开始录音，马上返回是否开起来了（以前这里没有返回值，页面就一直以为麦克风打不开） */
        @JavascriptInterface
        public boolean start(int maxMs, int silenceMs) { return start3(maxMs, silenceMs, 9000); }

        @JavascriptInterface
        public boolean start3(int maxMs, int silenceMs, int waitMs) {
            if (!hasMic()) { recorder.reset(); ui.post(MainActivity.this::askMic); return false; }
            boolean ok = recorder.start(maxMs, silenceMs, waitMs);
            if (!ok) Log.w(TAG, "record start failed: " + recorder.state());
            return ok;
        }

        @JavascriptInterface public String state() { return hasMic() || !"idle".equals(recorder.state()) ? recorder.state() : "error:perm"; }
        @JavascriptInterface public String error() { String s = recorder.state(); return s.startsWith("error:") ? s.substring(6) : ""; }
        @JavascriptInterface public int level() { return recorder.level(); }
        @JavascriptInterface public boolean speech() { return recorder.speech(); }
        @JavascriptInterface public void stop() { recorder.finish(); }
        @JavascriptInterface public void reset() { recorder.reset(); }

        /** 录好的声音：16kHz 16 位小端 PCM，base64 */
        @JavascriptInterface
        public String result() {
            short[] p = recorder.samples();
            ByteBuffer bb = ByteBuffer.allocate(p.length * 2).order(ByteOrder.LITTLE_ENDIAN);
            bb.asShortBuffer().put(p);
            return Base64.encodeToString(bb.array(), Base64.NO_WRAP);
        }
    }

    /* ---------------- 识别 ---------------- */
    final class AsrBridge {
        @JavascriptInterface public boolean available() { return Asr.available(getAssets()); }
        @JavascriptInterface public String state() { return Asr.state(); }
        @JavascriptInterface public String name() { return Asr.NAME; }
        @JavascriptInterface public long loadMs() { return Asr.loadMs(); }
        @JavascriptInterface public void load() { Asr.load(getAssets()); }
        /** 识别刚才录的那段 */
        @JavascriptInterface public int recognizeLast() { return Asr.submit(getAssets(), recorder.samples()); }
        /** 识别页面传来的声音（16kHz 16 位小端 PCM 的 base64），比如用 getUserMedia 录的或上传的文件 */
        @JavascriptInterface
        public int recognizePcm(String b64) {
            byte[] b = Base64.decode(b64 == null ? "" : b64, Base64.DEFAULT);
            short[] p = new short[b.length / 2];
            ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer().get(p);
            return Asr.submit(getAssets(), p);
        }
        /** 还没好返回空字符串；好了返回 {"text":..,"ms":..} 或 {"error":..} */
        @JavascriptInterface public String job(int id) { return Asr.job(id); }
    }

    /* ---------------- App ---------------- */
    final class AppBridge {
        @JavascriptInterface public int version() { return BuildConfig.VERSION_CODE; }
        @JavascriptInterface public String versionName() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public int webVersion() { return web.version(); }
        @JavascriptInterface public int bundledWeb() { return web.bundledVersion(); }
        @JavascriptInterface public String updateNote() { return web.updateNote; }
        @JavascriptInterface public void checkUpdate() { ui.post(() -> { lastUpdateCheck = 0; MainActivity.this.checkUpdate(); }); }
        @JavascriptInterface
        public boolean copy(String text) {
            try {
                ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
                cm.setPrimaryClip(ClipData.newPlainText("每日美语", text == null ? "" : text));
                return true;
            } catch (Exception e) { return false; }
        }
        @JavascriptInterface public void openUrl(String url) { ui.post(() -> openExternal(Uri.parse(url))); }
    }

    private void checkUpdate() {
        long now = System.currentTimeMillis();
        if (now - lastUpdateCheck < 20 * 60 * 1000L) return;
        lastUpdateCheck = now;
        web.checkUpdate(v -> ui.post(() -> {
            if (wv != null) wv.evaluateJavascript("try{window.dispatchEvent(new CustomEvent('dsh-update',{detail:" + v + "}))}catch(e){}", null);
        }));
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (pageLoadedOnce) checkUpdate();
    }

    private void openExternal(Uri u) {
        if (u == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "没有能打开这个链接的应用", Toast.LENGTH_SHORT).show();
        }
    }

    private void openAppSettings() {
        try {
            Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS)); } catch (Exception ignored) { }
        }
    }

    private void showError(String why) {
        if (wv == null) return;
        String html = "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
                + "<body style=\"margin:0;padding:28px;font-family:system-ui,sans-serif;background:#EEF0EC;color:#121418\">"
                + "<h2 style='font-size:22px;margin:0 0 10px'>页面没打开</h2>"
                + "<p style='font-size:15px;line-height:1.7;color:#555'>原因：" + android.text.TextUtils.htmlEncode(why) + "</p>"
                + "<button style='margin-top:14px;height:48px;padding:0 22px;border:0;border-radius:14px;background:#121418;color:#fff;font-size:16px;font-weight:700' "
                + "onclick=\"location.replace('" + WebFiles.START + "&r='+Date.now())\">重试</button></body>";
        wv.loadDataWithBaseURL(WebFiles.ORIGIN + "/", html, "text/html", "utf-8", null);
    }

    private void notifyMic() {
        if (wv != null) wv.evaluateJavascript("try{document.dispatchEvent(new Event('dsh-mic'))}catch(e){}", null);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != REQ_MIC) return;
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (res.length > 0) prefs.edit().putBoolean("micDenied", !ok).apply();
        if (pendingPerm != null) {
            try { if (ok) pendingPerm.grant(pendingPerm.getResources()); else pendingPerm.deny(); } catch (Exception ignored) { }
            pendingPerm = null;
        }
        if (!ok) Toast.makeText(this, "没给麦克风权限：跟读和口语用不了。可以在「我的 → 跟读识别」里重新打开", Toast.LENGTH_LONG).show();
        notifyMic();
    }

    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        super.onActivityResult(req, result, data);
        if (req == REQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCb = null;
        }
    }

    @Override
    public boolean onKeyDown(int key, KeyEvent e) {
        if (key == KeyEvent.KEYCODE_BACK && wv != null && wv.canGoBack()) { wv.goBack(); return true; }
        return super.onKeyDown(key, e);
    }

    @Override
    protected void onDestroy() {
        recorder.reset();
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        if (wv != null) { wv.destroy(); wv = null; }
        super.onDestroy();
    }
}
