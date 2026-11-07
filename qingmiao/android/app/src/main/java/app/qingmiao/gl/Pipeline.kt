package app.qingmiao.gl

import android.graphics.Bitmap
import android.opengl.GLES30
import android.opengl.GLUtils
import app.qingmiao.EditParams
import app.qingmiao.Filters
import app.qingmiao.Vision
import java.nio.ByteBuffer
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * 渲染管线（只能在 GL 线程上调用）。
 *
 * 导入时（每张图一次）：
 *   预览图 → [PREP] 工作分辨率(≤1024) → [BOX×2] → [COEF] → [BOX×2] = 引导滤波系数 A（磨皮/肤色/掩膜）
 *                                    → [DOWN] 1/4 → [BOX×2] → [COEF] → [BOX×2] = 系数 B（清晰度）
 * 每次调参：
 *   [FINAL] 预览分辨率 → RGBA8 + mipmap → [DISPLAY] 屏幕
 * 导出：
 *   原图全分辨率纹理 → [FINAL] 按 1024×1024 分块 → glReadPixels 直接写进整图缓冲
 * 系数只算一次、只依赖原图，所以导出和预览用的是同一份系数（所见即所得）。
 */
class Pipeline {
    private val quad = Quad()
    private val prep = Program(Shaders.VERTEX, Shaders.PREP)
    private val down = Program(Shaders.VERTEX, Shaders.DOWN)
    private val box = Program(Shaders.VERTEX, Shaders.BOX)
    private val coef = Program(Shaders.VERTEX, Shaders.COEF)
    private val finalProg = Program(Shaders.VERTEX, Shaders.FINAL)
    private val display = Program(Shaders.VERTEX, Shaders.DISPLAY)
    private val bgprep = Program(Shaders.VERTEX, Shaders.BGPREP)

    // AI 识别结果（分割、五官）；没有时用 1×1 的默认纹理
    private val defaultSeg = uploadBytes(byteArrayOf(0, 0, 255.toByte(), 0), 1, 1)
    private val defaultFeat = uploadBytes(byteArrayOf(0, 0, 0, 0), 1, 1)
    private var segTex = 0
    private var featTex = 0
    private var hasSeg = false
    private var blurT: RenderTarget? = null

    private var srcTex = 0
    var srcWidth = 0
        private set
    var srcHeight = 0
        private set

    /** 原图（全分辨率）尺寸：细纹理 σ、锐化半径、颗粒大小都按全分辨率像素定义，预览按比例换算。 */
    private var fullLong = 0
    private var fullW = 0
    private var fullH = 0
    private var lutTex = 0

    private val maps = ArrayList<RenderTarget>()
    private var coefA: RenderTarget? = null
    private var coefB: RenderTarget? = null
    private var preview: RenderTarget? = null
    private var previewDirty = true

    val hasImage get() = srcTex != 0

    /**
     * 设置预览图（在导入时调用一次），并计算引导滤波系数。
     * faces：人脸/脖子椭圆，每 4 个数一组 (cx, cy, rx, ry)，归一化坐标，y 向下；空 = 没检测到人脸。
     */
    fun setPreview(bitmap: Bitmap, fullWidth: Int, fullHeight: Int, faces: FloatArray, vision: Vision.Maps?) {
        releaseImage()
        srcTex = uploadTexture(bitmap)
        if (vision != null) {
            segTex = uploadBytes(vision.seg, vision.width, vision.height)
            featTex = uploadBytes(vision.feat, vision.width, vision.height)
            hasSeg = vision.hasSeg
        } else {
            hasSeg = false
        }
        srcWidth = bitmap.width
        srcHeight = bitmap.height
        fullLong = max(fullWidth, fullHeight)
        fullW = fullWidth
        fullH = fullHeight
        computeMaps(faces)
        preview = RenderTarget.rgba8(srcWidth, srcHeight, GLES30.GL_LINEAR_MIPMAP_LINEAR)
        previewDirty = true
    }

    fun invalidate() {
        previewDirty = true
    }

    /** 换滤镜查找表（512×512）；null = 无滤镜。 */
    fun setLut(bitmap: Bitmap?) {
        if (lutTex != 0) GLES30.glDeleteTextures(1, intArrayOf(lutTex), 0)
        lutTex = if (bitmap == null) 0 else uploadTexture(bitmap)
        previewDirty = true
    }

    /** 画一帧到当前绑定的默认帧缓冲（屏幕）。 */
    fun drawToScreen(viewW: Int, viewH: Int, params: EditParams, original: Boolean, bg: FloatArray) {
        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        GLES30.glViewport(0, 0, viewW, viewH)
        GLES30.glClearColor(bg[0], bg[1], bg[2], 1f)
        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT)
        val pv = preview ?: return
        if (previewDirty) {
            pv.bind()
            runFinal(srcTex, srcWidth, srcHeight, params, original, 0, 0, 0f, 0f, 1f, 1f, dither = 0f)
            GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, pv.tex())
            GLES30.glGenerateMipmap(GLES30.GL_TEXTURE_2D)
            previewDirty = false
            GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
            GLES30.glViewport(0, 0, viewW, viewH)
        }
        // 等比放进视图，四周留背景色
        val ar = srcWidth.toFloat() / srcHeight
        val vr = viewW.toFloat() / viewH
        val (hx, hy) = if (ar > vr) 1f to (vr / ar) else (ar / vr) to 1f
        display.use()
        display.set4f("uRect", -hx, -hy, hx, hy)
        display.set4f("uTexRect", 0f, 1f, 1f, 0f) // 纹理第 0 行是图片顶部
        display.texture("uTex", 0, pv.tex())
        quad.draw()
    }

    /**
     * 全分辨率导出：返回 RGBA 字节（与 Bitmap ARGB_8888 内存布局一致）。
     * fullBitmap 上传到显存后立刻回收，压低内存峰值（5000 万像素时能省下约 200MB）。
     */
    fun renderFull(fullBitmap: Bitmap, params: EditParams, onProgress: (Float) -> Unit): ByteBuffer {
        val w = fullBitmap.width
        val h = fullBitmap.height
        val tex = uploadTexture(fullBitmap)
        fullBitmap.recycle() // 调用方传进来的是专门给导出用的副本
        val out = ByteBuffer.allocateDirect(w * h * 4)
        val tile = 1024
        val target = RenderTarget.rgba8(min(tile, w), min(tile, h), GLES30.GL_NEAREST)
        try {
            val tilesX = (w + tile - 1) / tile
            val tilesY = (h + tile - 1) / tile
            val total = tilesX * tilesY
            var done = 0
            GLES30.glPixelStorei(GLES30.GL_PACK_ALIGNMENT, 1)
            GLES30.glPixelStorei(GLES30.GL_PACK_ROW_LENGTH, w)
            for (ty in 0 until tilesY) {
                for (tx in 0 until tilesX) {
                    val x0 = tx * tile
                    val y0 = ty * tile
                    val tw = min(tile, w - x0)
                    val th = min(tile, h - y0)
                    GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, target.fbo)
                    GLES30.glViewport(0, 0, tw, th)
                    runFinal(
                        tex, w, h, params, false, x0, y0,
                        x0.toFloat() / w, y0.toFloat() / h,
                        (x0 + tw).toFloat() / w, (y0 + th).toFloat() / h,
                        dither = 1f,
                    )
                    out.position((y0 * w + x0) * 4)
                    GLES30.glReadPixels(0, 0, tw, th, GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, out)
                    done++
                    onProgress(done.toFloat() / total)
                }
            }
            val err = GLES30.glGetError()
            if (err != GLES30.GL_NO_ERROR) throw GlException("导出渲染出错: 0x" + Integer.toHexString(err))
        } finally {
            GLES30.glPixelStorei(GLES30.GL_PACK_ROW_LENGTH, 0)
            GLES30.glPixelStorei(GLES30.GL_PACK_ALIGNMENT, 4)
            GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
            target.release()
            GLES30.glDeleteTextures(1, intArrayOf(tex), 0)
        }
        out.position(0)
        previewDirty = true
        return out
    }

    fun release() {
        releaseImage()
        if (lutTex != 0) GLES30.glDeleteTextures(1, intArrayOf(lutTex), 0)
        lutTex = 0
        GLES30.glDeleteTextures(2, intArrayOf(defaultSeg, defaultFeat), 0)
        bgprep.release()
        prep.release(); down.release(); box.release(); coef.release(); finalProg.release(); display.release()
        quad.release()
    }

    // ———————————————————— 内部 ————————————————————

    private fun releaseImage() {
        if (srcTex != 0) GLES30.glDeleteTextures(1, intArrayOf(srcTex), 0)
        srcTex = 0
        if (segTex != 0) GLES30.glDeleteTextures(1, intArrayOf(segTex), 0)
        if (featTex != 0) GLES30.glDeleteTextures(1, intArrayOf(featTex), 0)
        segTex = 0
        featTex = 0
        blurT = null
        maps.forEach { it.release() }
        maps.clear()
        coefA = null
        coefB = null
        preview?.release()
        preview = null
    }

    private fun computeMaps(faces: FloatArray) {
        val long = max(srcWidth, srcHeight)
        val workScale = min(1f, 1024f / long)
        val ww = max(1, (srcWidth * workScale).roundToInt())
        val wh = max(1, (srcHeight * workScale).roundToInt())

        // 级别 A：磨皮、肤色、皮肤掩膜
        val prepT = RenderTarget.half(ww, wh, 3).also { maps += it }
        prepT.bind()
        prep.use()
        setFull(prep)
        prep.texture("uSrc", 0, srcTex)
        prep.texture("uSeg", 1, if (segTex != 0) segTex else defaultSeg)
        prep.texture("uFeat", 2, if (featTex != 0) featTex else defaultFeat)
        prep.set1i("uHasSeg", if (hasSeg) 1 else 0)
        prep.set2f("uSrcTexel", 1f / srcWidth, 1f / srcHeight)
        prep.set1f("uOff", srcWidth.toFloat() / ww / 4f)
        val faceCount = min(8, faces.size / 4)
        prep.set1i("uFaceCount", faceCount)
        prep.set4fv("uFaces", faceCount, faces)
        quad.draw()

        val ra = max(2, (max(ww, wh) * 0.008f).roundToInt())
        val meanA = boxFilter(prepT, 3, ra)
        // 纹理门：有人脸定位时只挡住五官这类强结构；没有人脸时更严，挡住头发、织物等一切有纹理的区域
        val gate = if (faceCount > 0 || hasSeg) floatArrayOf(0.004f, 0.015f) else floatArrayOf(0.0012f, 0.0045f)
        coefA = coefficients(meanA, epsY = 0.003f, epsC = 0.003f, epsM = 0.01f, ra = ra, gate = gate)

        // 级别 B：清晰度用的大尺度底图
        val bw = max(1, ww / 4)
        val bh = max(1, wh / 4)
        val downT = RenderTarget.half(bw, bh, 1).also { maps += it }
        downT.bind()
        down.use()
        setFull(down)
        down.texture("uIn", 0, prepT.tex(0))
        down.set2f("uInTexel", 1f / ww, 1f / wh)
        down.set1f("uOff", ww.toFloat() / bw / 4f)
        quad.draw()
        val rb = 4
        val meanB = boxFilter(downT, 1, rb)
        coefB = coefficients(meanB, epsY = 0.004f, epsC = 0.004f, epsM = 0.01f, ra = rb, gate = gate)

        // 背景虚化：只在有人像分割时准备（预乘背景色后模糊三遍 ≈ 高斯）
        if (hasSeg) {
            val gw = max(1, ww / 2)
            val gh = max(1, wh / 2)
            val g0 = RenderTarget.half(gw, gh, 1).also { maps += it }
            g0.bind()
            bgprep.use()
            setFull(bgprep)
            bgprep.texture("uSrc", 0, srcTex)
            bgprep.texture("uSeg", 1, segTex)
            bgprep.set2f("uSrcTexel", 1f / srcWidth, 1f / srcHeight)
            bgprep.set1f("uOff", srcWidth.toFloat() / gw / 4f)
            quad.draw()
            val rg = max(3, (max(gw, gh) * 0.012f).roundToInt())
            blurT = boxFilter(boxFilter(boxFilter(g0, 1, rg), 1, rg), 1, rg)
        }

        GLES30.glBindFramebuffer(GLES30.GL_FRAMEBUFFER, 0)
        val err = GLES30.glGetError()
        if (err != GLES30.GL_NO_ERROR) throw GlException("预处理出错: 0x" + Integer.toHexString(err))
    }

    /** 可分离方框滤波：横向一遍、纵向一遍。输入的纹理数 = count（1~3）。 */
    private fun boxFilter(input: RenderTarget, count: Int, r: Int): RenderTarget {
        val w = input.width
        val h = input.height
        val tmp = RenderTarget.half(w, h, count).also { maps += it }
        val out = RenderTarget.half(w, h, count).also { maps += it }
        boxPass(input, tmp, count, r, 1f / w, 0f)
        boxPass(tmp, out, count, r, 0f, 1f / h)
        return out
    }

    private fun boxPass(input: RenderTarget, output: RenderTarget, count: Int, r: Int, sx: Float, sy: Float) {
        output.bind()
        box.use()
        setFull(box)
        box.texture("uT0", 0, input.tex(0))
        box.texture("uT1", 1, input.tex(min(1, count - 1)))
        box.texture("uT2", 2, input.tex(min(2, count - 1)))
        box.set2f("uStep", sx, sy)
        box.set1i("uR", r)
        quad.draw()
    }

    private fun coefficients(
        mean: RenderTarget, epsY: Float, epsC: Float, epsM: Float, ra: Int, gate: FloatArray,
    ): RenderTarget {
        val count = mean.textures.size
        val c = RenderTarget.half(mean.width, mean.height, if (count >= 2) 3 else 1).also { maps += it }
        c.bind()
        coef.use()
        setFull(coef)
        coef.texture("uM0", 0, mean.tex(0))
        coef.texture("uM1", 1, mean.tex(min(1, count - 1)))
        coef.texture("uM2", 2, mean.tex(min(2, count - 1)))
        coef.set1f("uEpsY", epsY)
        coef.set1f("uEpsC", epsC)
        coef.set1f("uEpsM", epsM)
        coef.set2f("uGate", gate[0], gate[1])
        quad.draw()
        return boxFilter(c, c.textures.size, ra)
    }

    private fun setFull(p: Program) {
        p.set4f("uRect", -1f, -1f, 1f, 1f)
        p.set4f("uTexRect", 0f, 0f, 1f, 1f)
    }

    private fun runFinal(
        tex: Int, texW: Int, texH: Int, params: EditParams, original: Boolean,
        noiseX: Int, noiseY: Int, u0: Float, v0: Float, u1: Float, v1: Float, dither: Float,
    ) {
        val a = coefA ?: return
        val b = coefB ?: return
        finalProg.use()
        finalProg.set4f("uRect", -1f, -1f, 1f, 1f)
        finalProg.set4f("uTexRect", u0, v0, u1, v1)
        finalProg.texture("uSrc", 0, tex)
        finalProg.texture("uA0", 1, a.tex(0))
        finalProg.texture("uA1", 2, a.tex(1))
        finalProg.texture("uA2", 3, a.tex(2))
        finalProg.texture("uB0", 4, b.tex(0))
        finalProg.set2f("uTexel", 1f / texW, 1f / texH)
        finalProg.texture("uLut", 5, if (lutTex != 0) lutTex else tex)
        finalProg.texture("uFeat", 6, if (featTex != 0) featTex else defaultFeat)
        finalProg.texture("uBlur", 7, blurT?.tex() ?: tex)
        finalProg.set1i("uHasSeg", if (hasSeg && blurT != null) 1 else 0)

        // 细纹理带 σ1 ≈ 1.4 px、锐化 σ2 ≈ 2 px（按 4000 px 长边的全分辨率），换算到当前纹理
        val scale = max(texW, texH) / fullLong.toFloat()
        val s1 = max(0.6f, 1.4f * fullLong / 4000f) * scale
        val s2 = (fullLong / 2000f).coerceIn(1f, 2.5f) * scale
        val sm = max(s1, s2)
        val radius = if (sm < 0.35f) 0 else min(4, ceil(2f * sm).toInt())
        finalProg.set1f("uSigma1", max(s1, 0.35f))
        finalProg.set1f("uSigma2", max(s2, 0.35f))
        finalProg.set1i("uRadius", radius)

        val u = Uniforms.from(params)
        finalProg.set1f("uSmooth", u.smooth)
        finalProg.set1f("uSmoothFine", u.smoothFine)
        finalProg.set1f("uEven", u.even)
        finalProg.set1f("uWhite", u.white)
        finalProg.set1f("uRosy", u.rosy)
        finalProg.set1f("uEyes", u.eyes)
        finalProg.set1f("uTeeth", u.teeth)
        finalProg.set1f("uLips", u.lips)
        finalProg.set1f("uUnderEye", u.underEye)
        finalProg.set1f("uBgBlur", u.bgBlur)
        finalProg.set1f("uBgDark", if (hasSeg) u.bgDark else 0f)
        finalProg.set1f("uGamma", u.gamma)
        finalProg.set1f("uContrastK", u.contrastK)
        finalProg.set1f("uHighlights", u.highlights)
        finalProg.set1f("uShadows", u.shadows)
        finalProg.set3f("uWb", u.wbR, u.wbG, u.wbB)
        finalProg.set1f("uSaturation", u.saturation)
        finalProg.set1f("uVibrance", u.vibrance)
        finalProg.set1f("uClarity", u.clarity)
        finalProg.set1f("uSharpen", u.sharpen)
        finalProg.set1f("uDehaze", u.dehaze)
        finalProg.set1f("uVignette", u.vignette)
        finalProg.set1f("uAspect", fullW.toFloat() / max(1, fullH))
        finalProg.set1f("uGrain", u.grain)
        val cell = max(1.5f, fullLong / 1500f)
        finalProg.set2f("uGrainScale", fullW / cell, fullH / cell)
        finalProg.set1f("uFilter", u.filter)
        finalProg.set1f("uFilterSkin", if (Filters.isMono(params.filter)) 0f else 0.3f)
        finalProg.set1i("uFilterOn", if (lutTex != 0 && u.filter > 0f) 1 else 0)
        finalProg.set1i("uOriginal", if (original) 1 else 0)
        finalProg.set1f("uDither", dither)
        finalProg.set2f("uNoiseOffset", noiseX.toFloat(), noiseY.toFloat())
        quad.draw()
    }

    private fun uploadBytes(rgba: ByteArray, w: Int, h: Int): Int {
        val ids = IntArray(1)
        GLES30.glGenTextures(1, ids, 0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, ids[0])
        GLES30.glPixelStorei(GLES30.GL_UNPACK_ALIGNMENT, 1)
        GLES30.glTexImage2D(
            GLES30.GL_TEXTURE_2D, 0, GLES30.GL_RGBA8, w, h, 0,
            GLES30.GL_RGBA, GLES30.GL_UNSIGNED_BYTE, ByteBuffer.wrap(rgba),
        )
        setSampling(GLES30.GL_LINEAR)
        return ids[0]
    }

    private fun uploadTexture(bitmap: Bitmap): Int {
        val ids = IntArray(1)
        GLES30.glGenTextures(1, ids, 0)
        GLES30.glBindTexture(GLES30.GL_TEXTURE_2D, ids[0])
        GLES30.glPixelStorei(GLES30.GL_UNPACK_ALIGNMENT, 1)
        GLUtils.texImage2D(GLES30.GL_TEXTURE_2D, 0, bitmap, 0)
        setSampling(GLES30.GL_LINEAR)
        val err = GLES30.glGetError()
        if (err != GLES30.GL_NO_ERROR) {
            GLES30.glDeleteTextures(1, ids, 0)
            throw GlException("上传图片到显存失败: 0x" + Integer.toHexString(err))
        }
        return ids[0]
    }
}

/** 滑杆数值 → 着色器参数。所有强度上限都在这里。 */
data class Uniforms(
    val smooth: Float,
    val smoothFine: Float,
    val even: Float,
    val white: Float,
    val rosy: Float,
    val eyes: Float,
    val teeth: Float,
    val lips: Float,
    val underEye: Float,
    val bgBlur: Float,
    val bgDark: Float,
    val gamma: Float,
    val contrastK: Float,
    val highlights: Float,
    val shadows: Float,
    val wbR: Float,
    val wbG: Float,
    val wbB: Float,
    val saturation: Float,
    val vibrance: Float,
    val clarity: Float,
    val sharpen: Float,
    val dehaze: Float,
    val vignette: Float,
    val grain: Float,
    val filter: Float,
) {
    companion object {
        private fun unit(v: Float) = (v / 100f).coerceIn(0f, 1f)
        private fun bi(v: Float) = (v / 100f).coerceIn(-1f, 1f)

        fun from(p: EditParams): Uniforms {
            val smooth = unit(p.smooth)
            val b = bi(p.brightness)
            val c = bi(p.contrast)
            val t = bi(p.temperature)
            val tint = bi(p.tint)
            var r = exp(0.22f * t)
            var g = exp(-0.15f * tint)
            var bl = exp(-0.22f * t)
            // 归一化：中性灰的亮度保持不变，色温色调只改颜色不改明暗
            val y = 0.2126f * r + 0.7152f * g + 0.0722f * bl
            r /= y; g /= y; bl /= y
            val sat = bi(p.saturation)
            return Uniforms(
                smooth = smooth,
                smoothFine = 0.3f * ((smooth - 0.5f) / 0.5f).coerceIn(0f, 1f),
                even = unit(p.even),
                white = unit(p.white),
                rosy = unit(p.rosy),
                eyes = unit(p.eyes),
                teeth = unit(p.teeth),
                lips = bi(p.lips),
                underEye = unit(p.underEye),
                bgBlur = unit(p.bgBlur),
                bgDark = unit(p.bgDark),
                gamma = 2.0.pow(-0.9 * b).toFloat(),
                contrastK = if (c >= 0f) 1f + 0.9f * c else 1f / (1f + 0.9f * -c),
                highlights = bi(p.highlights),
                shadows = bi(p.shadows),
                wbR = r, wbG = g, wbB = bl,
                saturation = if (sat > 0f) 0.8f * sat else sat,
                vibrance = 0.9f * bi(p.vibrance),
                clarity = bi(p.clarity),
                sharpen = 1.5f * unit(p.sharpen),
                dehaze = bi(p.dehaze),
                vignette = bi(p.vignette),
                grain = unit(p.grain),
                filter = if (p.filter == null) 0f else unit(p.filterStrength),
            )
        }
    }
}
