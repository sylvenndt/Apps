package app.qingmiao

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import dalvik.system.DexClassLoader

/**
 * 外壳：启动时先更新、再加载核心代码。修图的功能和界面全在核心里（core 模块），
 * 核心放在网上，所以改完推上去，下次打开就是新版，不用重装。
 */
class MainActivity : ComponentActivity() {

    private var entry: Any? = null
    private var entryClass: Class<*>? = null
    private var loadedVersion = 0
    private var checking = false
    private val main = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        installCrashGuard()
        val status = splash()
        Thread {
            val core = Updater.prepare(this) { msg -> runOnUiThread { status.text = msg } }
            runOnUiThread { launch(core, savedInstanceState) }
        }.start()
    }

    private fun splash(): TextView {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#121012"))
        }
        val title = TextView(this).apply {
            text = "轻描"
            textSize = 36f
            setTextColor(Color.parseColor("#F3EDEA"))
            gravity = Gravity.CENTER
        }
        val status = TextView(this).apply {
            text = "只改一点点"
            textSize = 14f
            setTextColor(Color.parseColor("#A39893"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 0)
        }
        box.addView(title)
        box.addView(status)
        setContentView(box)
        return status
    }

    private fun launch(core: Updater.Core, saved: Bundle?) {
        try {
            val loader = DexClassLoader(core.file.absolutePath, null, null, classLoader)
            val cls = loader.loadClass("app.qingmiao.core.Entry")
            val e = cls.getDeclaredConstructor().newInstance()
            loadedVersion = core.version
            entry = e
            entryClass = cls
            val info = "版本 ${core.version}" + (if (core.bundled) "（内置）" else "") + " · 外壳 ${Updater.SHELL_VERSION}" +
                (if (Updater.needsNewShell(this)) " · 有需要重装的新版" else "")
            cls.getMethod(
                "onCreate",
                ComponentActivity::class.java,
                Bundle::class.java,
                String::class.java,
            ).invoke(e, this, saved, info)
            // 正常跑了 20 秒，就认为这个版本是好的
            main.postDelayed({ Updater.markHealthy(this, core.version) }, 20_000)
        } catch (t: Throwable) {
            if (!core.bundled) {
                Updater.markBad(this, core.version)
                launch(Updater.bundled(this), saved)
            } else {
                val tv = TextView(this).apply {
                    text = "启动失败：${t.cause?.message ?: t.message}\n请把这段话截图发给 Claude"
                    setTextColor(Color.WHITE)
                    setBackgroundColor(Color.parseColor("#121012"))
                    setPadding(48, 200, 48, 48)
                }
                setContentView(tv)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        try {
            entryClass?.getMethod("onNewIntent", Intent::class.java)?.invoke(entry, intent)
        } catch (t: Throwable) {
            // 忽略
        }
    }

    override fun onResume() {
        super.onResume()
        // 用着的时候也看一眼有没有新版；有就下载好，问一下要不要马上刷新
        if (loadedVersion == 0 || checking) return
        checking = true
        Thread {
            val v = Updater.downloadIfNewer(this, loadedVersion)
            runOnUiThread {
                checking = false
                if (v != null && !isFinishing) {
                    AlertDialog.Builder(this)
                        .setTitle("轻描有新版本")
                        .setMessage("已经下载好了。现在刷新吗？（正在修的图会关掉）")
                        .setPositiveButton("刷新") { _, _ -> recreate() }
                        .setNegativeButton("稍后") { _, _ -> }
                        .show()
                }
            }
        }.start()
    }

    private fun installCrashGuard() {
        current = this
        if (guardInstalled) return
        guardInstalled = true
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            current?.let { a -> if (a.loadedVersion > 0) Updater.recordCrash(a, a.loadedVersion) }
            previous?.uncaughtException(thread, error)
        }
    }

    companion object {
        @Volatile private var guardInstalled = false
        @Volatile private var current: MainActivity? = null
    }
}
