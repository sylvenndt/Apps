package app.qingmiao

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * 在线更新：每次启动先看网上有没有更新的核心代码（core-N.jar），有就下载，然后加载最新的那份。
 * 网络不通就用上次下载的；都没有就用安装包里自带的那份。
 */
object Updater {

    /** 外壳版本。只有外壳本身（库、模型、这几个文件）变了才加一，并同步改 min-shell.txt。 */
    const val SHELL_VERSION = 2

    private val META_URLS = listOf(
        "https://sylvenndt.github.io/Apps/qingmiao/update/core.json",
        "https://cdn.jsdelivr.net/gh/sylvenndt/Apps@main/qingmiao/update/core.json",
    )
    private const val PREFS = "qingmiao_shell"

    class Core(val file: File, val version: Int, val bundled: Boolean)

    class Remote(val version: Int, val url: String, val sha256: String, val minShell: Int)

    private fun dir(ctx: Context) = File(ctx.filesDir, "core").apply { mkdirs() }

    /** 安装包自带的核心（第一次打开、或离线时用）。 */
    fun bundled(ctx: Context): Core {
        val version = ctx.assets.open("core/version.txt").bufferedReader().use { it.readText().trim().toInt() }
        val f = File(dir(ctx), "bundled-$version.jar")
        if (!f.exists()) {
            val tmp = File(dir(ctx), "bundled.tmp")
            tmp.delete()
            ctx.assets.open("core/core.jar").use { input -> tmp.outputStream().use { input.copyTo(it) } }
            tmp.renameTo(f)
        }
        f.setReadOnly() // Android 14 起，动态加载的代码文件必须只读
        return Core(f, version, true)
    }

    /** 上次下载好的核心。 */
    fun cached(ctx: Context): Core? {
        val v = prefs(ctx).getInt("cached", 0)
        if (v <= 0) return null
        val f = File(dir(ctx), "core-$v.jar")
        return if (f.exists()) Core(f, v, false) else null
    }

    /** 选出这次要加载的核心：能联网就先更新到最新。 */
    fun prepare(ctx: Context, onStatus: (String) -> Unit): Core {
        val bundled = bundled(ctx)
        var best = cached(ctx)?.takeIf { it.version > bundled.version && !isBad(ctx, it.version) } ?: bundled
        try {
            onStatus("正在检查更新…")
            val remote = fetchRemote(2500)
            if (remote != null) prefs(ctx).edit().putBoolean("needShell", remote.minShell > SHELL_VERSION).apply()
            if (remote != null && remote.version > best.version && remote.minShell <= SHELL_VERSION && !isBad(ctx, remote.version)) {
                onStatus("正在下载新版…")
                best = download(ctx, remote)
            }
        } catch (e: Throwable) {
            // 没网或下载失败：用手上已有的
        }
        cleanup(ctx, best)
        return best
    }

    /** 后台看看有没有新版（App 用着的时候），有就下载好，返回新版本号。 */
    fun downloadIfNewer(ctx: Context, current: Int): Int? {
        return try {
            val remote = fetchRemote(5000) ?: return null
            if (remote.version <= current || remote.minShell > SHELL_VERSION || isBad(ctx, remote.version)) return null
            download(ctx, remote).version
        } catch (e: Throwable) {
            null
        }
    }

    /** 网上的核心要求更新的外壳时返回 true（需要重装一次）。 */
    fun needsNewShell(ctx: Context): Boolean = prefs(ctx).getBoolean("needShell", false)

    private fun fetchRemote(timeoutMs: Int): Remote? {
        for (base in META_URLS) {
            try {
                val text = get("$base?t=${System.currentTimeMillis()}", timeoutMs).toString(Charsets.UTF_8)
                val o = JSONObject(text)
                val url = URL(URL(base), o.getString("file")).toString()
                return Remote(o.getInt("version"), url, o.getString("sha256"), o.optInt("minShell", 1))
            } catch (e: Throwable) {
                continue
            }
        }
        return null
    }

    private fun download(ctx: Context, r: Remote): Core {
        val f = File(dir(ctx), "core-${r.version}.jar")
        if (!f.exists()) {
            val bytes = get(r.url, 20000)
            val sha = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
            if (!sha.equals(r.sha256, ignoreCase = true)) throw IllegalStateException("校验失败")
            val tmp = File(dir(ctx), "download.tmp")
            tmp.delete()
            tmp.writeBytes(bytes)
            if (!tmp.renameTo(f)) throw IllegalStateException("保存失败")
        }
        f.setReadOnly()
        prefs(ctx).edit().putInt("cached", r.version).apply()
        return Core(f, r.version, false)
    }

    private fun get(url: String, timeoutMs: Int): ByteArray {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = timeoutMs
            conn.readTimeout = timeoutMs
            conn.useCaches = false
            conn.setRequestProperty("Cache-Control", "no-cache")
            if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
            return conn.inputStream.use { it.readBytes() }
        } finally {
            conn.disconnect()
        }
    }

    /** 只保留正在用的和安装包自带的，旧版本删掉。 */
    private fun cleanup(ctx: Context, keep: Core) {
        dir(ctx).listFiles()?.forEach { f ->
            if (f.name.endsWith(".jar") && f != keep.file && !f.name.startsWith("bundled-")) {
                f.setWritable(true)
                f.delete()
            }
        }
    }

    // —— 崩溃保护：某个在线版本连续闪退两次，就退回安装包自带的版本 ——

    fun recordCrash(ctx: Context, version: Int) {
        val p = prefs(ctx)
        p.edit().putInt("crash-$version", p.getInt("crash-$version", 0) + 1).commit()
    }

    fun markHealthy(ctx: Context, version: Int) {
        prefs(ctx).edit().remove("crash-$version").apply()
    }

    fun markBad(ctx: Context, version: Int) {
        prefs(ctx).edit().putInt("crash-$version", 99).commit()
    }

    private fun isBad(ctx: Context, version: Int) = prefs(ctx).getInt("crash-$version", 0) >= 2

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
