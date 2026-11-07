package app.qingmiao.gl

import android.content.Context
import android.graphics.Bitmap
import android.opengl.GLES30
import android.opengl.GLSurfaceView
import android.os.Handler
import android.os.Looper
import app.qingmiao.EditParams
import app.qingmiao.Vision
import kotlinx.coroutines.suspendCancellableCoroutine
import java.nio.ByteBuffer
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * 编辑器的显卡端：持有 GLSurfaceView 和渲染管线。
 * 界面线程只改参数并 requestRender；所有 GL 调用都在 GL 线程上。
 */
class EditorEngine(context: Context) : GLSurfaceView.Renderer {

    val view: GLSurfaceView = GLSurfaceView(context).apply {
        setEGLContextClientVersion(3)
        preserveEGLContextOnPause = true
    }

    @Volatile private var params = EditParams()
    @Volatile private var original = false
    @Volatile var maxTextureSize = 4096
        private set

    var onError: ((String) -> Unit)? = null

    // —— 以下只在 GL 线程访问 ——
    private var pipeline: Pipeline? = null
    private var source: Bitmap? = null
    private var fullW = 0
    private var fullH = 0
    private var faces = FloatArray(0)
    private var vision: Vision.Maps? = null
    private var lut: Bitmap? = null
    private var viewW = 1
    private var viewH = 1
    private var renderedParams: EditParams? = null
    private var renderedOriginal = false

    private val main = Handler(Looper.getMainLooper())

    init {
        view.setRenderer(this)
        view.renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
    }

    fun setImage(bitmap: Bitmap, fullWidth: Int, fullHeight: Int, faceEllipses: FloatArray, maps: Vision.Maps?) {
        view.queueEvent {
            source = bitmap
            fullW = fullWidth
            fullH = fullHeight
            faces = faceEllipses
            vision = maps
            loadSource()
        }
        view.requestRender()
    }

    /** 换滤镜查找表；null = 不用滤镜。 */
    fun setLut(bitmap: Bitmap?) {
        view.queueEvent {
            try {
                pipeline?.setLut(bitmap)
                lut = bitmap
                renderedParams = null
            } catch (e: Exception) {
                report(e)
            }
        }
        view.requestRender()
    }

    fun update(p: EditParams) {
        params = p
        view.requestRender()
    }

    fun setOriginal(on: Boolean) {
        original = on
        view.requestRender()
    }

    /** 全分辨率渲染（导出用）。 */
    suspend fun renderFull(full: Bitmap, p: EditParams, onProgress: (Float) -> Unit): ByteBuffer =
        suspendCancellableCoroutine { cont ->
            view.queueEvent {
                val pl = pipeline
                if (pl == null || !pl.hasImage) {
                    cont.resumeWithException(GlException("显卡还没准备好，请稍后再试"))
                } else {
                    try {
                        val buf = pl.renderFull(full, p, onProgress)
                        cont.resume(buf)
                    } catch (e: Throwable) {
                        cont.resumeWithException(e)
                    }
                    renderedParams = null
                }
                view.requestRender()
            }
        }

    fun release() {
        view.queueEvent {
            pipeline?.release()
            pipeline = null
            source = null
        }
    }

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        val v = IntArray(1)
        GLES30.glGetIntegerv(GLES30.GL_MAX_TEXTURE_SIZE, v, 0)
        if (v[0] > 0) maxTextureSize = v[0]
        pipeline = try {
            Pipeline()
        } catch (e: Exception) {
            report(e)
            null
        }
        loadSource()
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        viewW = width
        viewH = height
        renderedParams = null
    }

    override fun onDrawFrame(gl: GL10?) {
        val pl = pipeline
        if (pl == null) {
            GLES30.glClearColor(BG[0], BG[1], BG[2], 1f)
            GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
            return
        }
        val p = params
        val o = original
        if (p != renderedParams || o != renderedOriginal) {
            pl.invalidate()
            renderedParams = p
            renderedOriginal = o
        }
        try {
            pl.drawToScreen(viewW, viewH, p, o, BG)
        } catch (e: Exception) {
            report(e)
        }
    }

    private fun loadSource() {
        val bmp = source ?: return
        val pl = pipeline ?: return
        try {
            pl.setPreview(bmp, fullW, fullH, faces, vision)
            lut?.let { pl.setLut(it) }
            renderedParams = null
        } catch (e: Exception) {
            report(e)
        }
    }

    private fun report(e: Throwable) {
        val msg = e.message ?: e.javaClass.simpleName
        main.post { onError?.invoke(msg) }
    }

    companion object {
        val BG = floatArrayOf(0x12 / 255f, 0x10 / 255f, 0x12 / 255f)
    }
}
