package com.sylvenndt.dailyenglish;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * App 的页面文件。
 *
 * 页面用固定的地址 https://appassets.androidplatform.net/linking-practice/ 打开（安卓保留的域名，不会真的联网），
 * 每个请求都在这里回答：
 *   ① 联网下载过的新版页面（files/web/vN/）  ② 安装包里自带的页面（assets/web/）  ③ 都没有的文件，去 GitHub Pages 取。
 * 地址固定不变，所以学习记录、设置、缓存的 AI 语音模型都会一直留着（旧版每次打开换一个端口，等于每次都是新网站）。
 *
 * 在线更新：联网时读 GitHub Pages 上的 sw.js（里面有版本号和页面文件清单），版本更新就把这些文件下载到 files/web/vN/，
 * 全部下完、核对版本号后才切换过去。下次打开（或者点页面顶部的提示条）就是新版。
 */
final class WebFiles {
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST;
    static final String START = ORIGIN + "/linking-practice/index.html?app=1";
    static final String PAGES = "https://sylvenndt.github.io/Apps/";
    private static final String TAG = "DshWeb";
    private static final String APP = "linking-practice/";
    private static final Pattern VER = Pattern.compile("const\\s+V\\s*=\\s*\"\\?v=(\\d+)\"");
    private static final Pattern CORE = Pattern.compile("const\\s+CORE\\s*=\\s*\\[(.*?)\\];", Pattern.DOTALL);
    private static final Pattern STR = Pattern.compile("\"([^\"]+)\"");
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html"); MIME.put("js", "text/javascript"); MIME.put("mjs", "text/javascript");
        MIME.put("css", "text/css"); MIME.put("json", "application/json"); MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg"); MIME.put("svg", "image/svg+xml"); MIME.put("wasm", "application/wasm");
        MIME.put("bin", "application/octet-stream"); MIME.put("ogg", "audio/ogg"); MIME.put("mp3", "audio/mpeg");
        MIME.put("wav", "audio/wav"); MIME.put("txt", "text/plain"); MIME.put("ico", "image/x-icon");
        MIME.put("webmanifest", "application/manifest+json");
    }

    private final Context ctx;
    private final AssetManager assets;
    private final File root;
    private final int bundled;
    private volatile File active;     // 正在用的下载版目录（没有就是 null，用安装包里的）
    private volatile int activeVer;
    volatile String updateNote = "";  // 最近一次检查更新的结果，给「我的」页面看

    WebFiles(Context c) {
        ctx = c;
        assets = c.getAssets();
        root = new File(c.getFilesDir(), "web");
        bundled = versionOf(readAsset("web/" + APP + "sw.js"));
        pickActive();
    }

    int bundledVersion() { return bundled; }
    int version() { return active != null ? activeVer : bundled; }

    private void pickActive() {
        File best = null; int bv = 0;
        File[] ds = root.listFiles();
        if (ds != null) for (File d : ds) {
            if (!d.isDirectory() || !d.getName().matches("v\\d+")) continue;
            int v = Integer.parseInt(d.getName().substring(1));
            if (!new File(d, "OK").exists()) continue;
            if (v > bv) { bv = v; best = d; }
        }
        // 安装包里的比下载的还新（装了新安装包），就用安装包里的
        if (best != null && bv > bundled) { active = best; activeVer = bv; }
        else { active = null; activeVer = 0; }
        // 清掉用不上的旧目录
        if (ds != null) for (File d : ds) if (d.isDirectory() && !d.equals(active)) deleteTree(d);
    }

    /** WebView 的请求：是我们的地址就回答，不是就返回 null 让 WebView 自己去联网 */
    WebResourceResponse handle(Uri u, String method) {
        if (u == null || !HOST.equals(u.getHost())) return null;
        String path = u.getPath() == null ? "/" : u.getPath();
        if (path.startsWith("/")) path = path.substring(1);
        if (path.isEmpty() || path.equals(APP.substring(0, APP.length() - 1))) path = APP + "index.html";
        if (path.endsWith("/")) path += "index.html";
        if (path.contains("..")) return status(403, "forbidden");
        boolean head = "HEAD".equalsIgnoreCase(method);
        try {
            InputStream in = open(path);
            if (in != null) return ok(path, head ? new ByteArrayInputStream(new byte[0]) : in);
            return proxy(path, u.getEncodedQuery(), head);
        } catch (Exception e) {
            Log.w(TAG, "serve " + path, e);
            return status(500, String.valueOf(e));
        }
    }

    /** 本地有的文件：先下载版，再安装包 */
    InputStream open(String path) {
        File a = active;
        if (a != null) {
            File f = new File(a, path);
            if (f.isFile()) { try { return new FileInputStream(f); } catch (IOException ignored) { } }
        }
        try { return assets.open("web/" + path); } catch (IOException e) { return null; }
    }

    private WebResourceResponse proxy(String path, String query, boolean head) {
        HttpURLConnection c = null;
        try {
            URL url = new URL(PAGES + path + (query != null && !query.isEmpty() ? "?" + query : ""));
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(20000);
            if (head) c.setRequestMethod("HEAD");
            int code = c.getResponseCode();
            if (code != 200) { c.disconnect(); return status(code == 404 ? 404 : 502, "not found: " + path); }
            return resp(path, code, "OK", head ? new ByteArrayInputStream(new byte[0]) : c.getInputStream());
        } catch (Exception e) {
            if (c != null) c.disconnect();
            return status(504, "offline: " + path);
        }
    }

    private static String mime(String path) {
        int dot = path.lastIndexOf('.');
        String m = MIME.get(dot >= 0 ? path.substring(dot + 1).toLowerCase(Locale.ROOT) : "");
        return m != null ? m : "application/octet-stream";
    }

    private static WebResourceResponse ok(String path, InputStream in) { return resp(path, 200, "OK", in); }

    private static WebResourceResponse resp(String path, int code, String reason, InputStream in) {
        String m = mime(path);
        boolean text = m.startsWith("text/") || m.endsWith("json") || m.endsWith("javascript");
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        return new WebResourceResponse(m, text ? "utf-8" : null, code, reason, h, in);
    }

    private static WebResourceResponse status(int code, String msg) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/plain", "utf-8", code, code == 404 ? "Not Found" : "Error", h,
                new ByteArrayInputStream(msg.getBytes(StandardCharsets.UTF_8)));
    }

    /* ---------------- 在线更新 ---------------- */

    interface Done { void updated(int version); }

    /** 后台检查一次新版页面；下好了回调 done（在后台线程里） */
    void checkUpdate(final Done done) {
        new Thread(() -> {
            try {
                String sw = fetchText(PAGES + APP + "sw.js?dsh=" + System.currentTimeMillis());
                int v = versionOf(sw);
                if (v <= 0) { updateNote = "没读到版本号"; return; }
                if (v <= version()) { updateNote = "已是最新（" + version() + "）"; return; }
                List<String> files = coreFiles(sw);
                if (files.isEmpty()) { updateNote = "没读到文件清单"; return; }
                File tmp = new File(root, "tmp" + v);
                deleteTree(tmp);
                File dir = new File(tmp, APP);
                if (!dir.mkdirs()) throw new IOException("建目录失败");
                for (String f : files) {
                    byte[] b = fetch(PAGES + APP + f + "?v=" + v + "&dsh=" + System.currentTimeMillis());
                    File out = new File(dir, f);
                    File p = out.getParentFile();
                    if (p != null) p.mkdirs();
                    try (OutputStream o = new FileOutputStream(out)) { o.write(b); }
                }
                writeFile(new File(dir, "sw.js"), sw.getBytes(StandardCharsets.UTF_8));
                // 核对：页面和 core.js 必须是同一版（GitHub 刚推上去时可能新旧混着）
                String idx = new String(readFile(new File(dir, "index.html")), StandardCharsets.UTF_8);
                String core = new File(dir, "core.js").isFile() ? new String(readFile(new File(dir, "core.js")), StandardCharsets.UTF_8) : "";
                if (!idx.contains("?v=" + v) || (!core.isEmpty() && !core.matches("(?s).*APP_VERSION\\s*=\\s*" + v + "\\b.*"))) {
                    deleteTree(tmp);
                    updateNote = "新版 " + v + " 还没发布完整，下次再试";
                    return;
                }
                writeFile(new File(tmp, "OK"), String.valueOf(v).getBytes(StandardCharsets.UTF_8));
                File fin = new File(root, "v" + v);
                deleteTree(fin);
                if (!tmp.renameTo(fin)) throw new IOException("切换目录失败");
                pickActive();
                updateNote = "已下载新版 " + v;
                if (done != null) done.updated(v);
            } catch (Exception e) {
                updateNote = "没连上 GitHub（" + e.getClass().getSimpleName() + "），用的是手机里的版本";
                Log.i(TAG, "update check failed: " + e);
            }
        }, "dsh-web-update").start();
    }

    static List<String> coreFiles(String sw) {
        List<String> out = new ArrayList<>();
        Matcher m = CORE.matcher(sw == null ? "" : sw);
        if (!m.find()) return out;
        Matcher s = STR.matcher(m.group(1));
        while (s.find()) {
            String f = s.group(1).trim();
            if (f.isEmpty() || f.equals("./") || f.contains("..") || f.startsWith("/") || f.contains("://")) continue;
            int q = f.indexOf('?');
            if (q >= 0) f = f.substring(0, q);
            if (!out.contains(f)) out.add(f);
        }
        if (!out.contains("index.html")) out.add("index.html");
        return out;
    }

    static int versionOf(String sw) {
        if (sw == null) return 0;
        Matcher m = VER.matcher(sw);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private String readAsset(String p) {
        try (InputStream in = assets.open(p)) { return new String(readAll(in), StandardCharsets.UTF_8); }
        catch (IOException e) { return ""; }
    }

    private static String fetchText(String u) throws IOException { return new String(fetch(u), StandardCharsets.UTF_8); }

    private static byte[] fetch(String u) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(6000);
        c.setReadTimeout(15000);
        c.setRequestProperty("Cache-Control", "no-cache");
        try {
            int code = c.getResponseCode();
            if (code != 200) throw new IOException("HTTP " + code + " " + u);
            try (InputStream in = c.getInputStream()) { return readAll(in); }
        } finally { c.disconnect(); }
    }

    static byte[] readAll(InputStream in) throws IOException {
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        return b.toByteArray();
    }

    private static byte[] readFile(File f) throws IOException { try (InputStream in = new FileInputStream(f)) { return readAll(in); } }

    private static void writeFile(File f, byte[] b) throws IOException { try (OutputStream o = new FileOutputStream(f)) { o.write(b); } }

    static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] cs = f.listFiles();
        if (cs != null) for (File c : cs) deleteTree(c);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
