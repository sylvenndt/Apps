package app.qingmiao

import android.graphics.Bitmap
import android.graphics.PointF
import android.media.FaceDetector
import kotlin.math.atan2
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * 一键美化：看一眼照片（缩到 256 px），给出「最少的改动」。
 * 结果只取决于原图，所以连点多少次都一样（幂等），不会越修越重。
 */
object Analyzer {

    /** faces：人脸与脖子的椭圆 (cx, cy, rx, ry)×n，归一化坐标，y 向下。 */
    class Result(val params: EditParams, val skinRatio: Float, val faces: FloatArray)

    fun analyze(bitmap: Bitmap): Result {
        val faces = detectFaces(bitmap)
        val scale = 256f / max(bitmap.width, bitmap.height)
        val small = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                max(1, (bitmap.width * scale).roundToInt()),
                max(1, (bitmap.height * scale).roundToInt()),
                true,
            )
        } else bitmap
        val w = small.width
        val h = small.height
        val px = IntArray(w * h)
        small.getPixels(px, 0, w, 0, 0, w, h)
        if (small !== bitmap) small.recycle()

        val hist = IntArray(256)
        var skin = 0.0
        var sr = 0.0
        var sg = 0.0
        var sb = 0.0
        var n = 0
        for (p in px) {
            val r = ((p shr 16) and 255) / 255f
            val g = ((p shr 8) and 255) / 255f
            val b = (p and 255) / 255f
            val y = 0.299f * r + 0.587f * g + 0.114f * b
            hist[(y * 255f).roundToInt().coerceIn(0, 255)]++
            val cb = (b - y) * 0.564f
            val cr = (r - y) * 0.713f
            val m = skinMask(y, cb, cr)
            skin += m
            if (m < 0.2f && y > 0.08f && y < 0.95f) {
                sr += toLinear(r); sg += toLinear(g); sb += toLinear(b); n++
            }
        }
        val total = px.size.toFloat()
        val skinRatio = (skin / total).toFloat()
        val median = percentile(hist, total, 0.5f)
        val p05 = percentile(hist, total, 0.05f)
        val p95 = percentile(hist, total, 0.95f)

        val p10 = percentile(hist, total, 0.10f)
        val p98 = percentile(hist, total, 0.98f)

        // 亮度：把中间调往 0.48 拉，纠正 70%（保留一点原本的明暗气氛）
        var brightness = 0f
        run {
            val m = median.coerceIn(0.03f, 0.97f)
            val target = 0.48f
            if (kotlin.math.abs(m - target) > 0.04f) {
                val gamma = ln(target) / ln(m)                    // L' = L^gamma
                val b = -ln(gamma) / ln(2f) / 0.9f                // 与 Uniforms 里 gamma = 2^(-0.9 b) 对应
                brightness = (b * 0.7f * 100f).coerceIn(-45f, 45f)
            }
        }

        // 对比：发灰的照片多加，正常的也给一点通透
        val spread = p95 - p05
        val contrast = if (spread < 0.6f) ((0.6f - spread) * 80f + 8f).coerceIn(8f, 28f) else 8f
        // 高光快溢出就压一点，暗部大片发黑就提一点
        val highlights = if (p98 > 0.96f) -25f else if (p98 > 0.9f) -10f else 0f
        val shadows = if (p10 < 0.08f) 25f else if (p10 < 0.15f) 12f else 0f

        // 白平衡：灰世界估计偏色，纠正 50%（室内暖光不会被硬扳成冷白）
        var temperature = 0f
        var tint = 0f
        if (n > 50) {
            val r = sr / n; val g = sg / n; val b = sb / n
            val warm = ln(r / b).toFloat()                       // >0 偏暖
            val green = ln(g / sqrt(r * b)).toFloat()            // >0 偏绿
            temperature = (-0.5f * warm / 0.44f * 100f).coerceIn(-40f, 40f)
            tint = (0.5f * green / 0.15f * 100f).coerceIn(-30f, 30f)
        }

        // 有人脸：正常人像档；没检测到人脸但有大片肤色：轻一点；都没有：不动皮肤
        val portrait = faces.isNotEmpty()
        val maybePeople = !portrait && skinRatio > 0.03f
        val params = EditParams(
            smooth = if (portrait) 55f else if (maybePeople) 35f else 0f,
            even = if (portrait) 45f else if (maybePeople) 30f else 0f,
            white = if (portrait) 30f else if (maybePeople) 20f else 0f,
            rosy = if (portrait) 12f else 0f,
            brightness = brightness.round1(),
            contrast = contrast.round1(),
            highlights = highlights,
            shadows = shadows,
            vibrance = 15f,
            temperature = temperature.round1(),
            tint = tint.round1(),
            clarity = if (portrait) 12f else 25f,
            sharpen = if (portrait) 20f else 30f,
        )
        return Result(params, skinRatio, faces)
    }

    /**
     * 用系统自带的人脸检测（android.media.FaceDetector，纯本地、无模型文件）找到双眼位置，
     * 再按眼距推出脸和脖子的椭圆。只用于「定位哪里是皮肤」，不用于任何形变。
     */
    fun detectFaces(bitmap: Bitmap): FloatArray {
        return try {
            val scale = min(1f, 512f / max(bitmap.width, bitmap.height))
            var w = max(2, (bitmap.width * scale).roundToInt())
            if (w % 2 == 1) w -= 1
            val h = max(2, (bitmap.height * scale).roundToInt())
            val scaled = Bitmap.createScaledBitmap(bitmap, w, h, true)
            val rgb565 = scaled.copy(Bitmap.Config.RGB_565, false)
            if (scaled !== bitmap) scaled.recycle()
            val maxFaces = 4
            val found = arrayOfNulls<FaceDetector.Face>(maxFaces)
            val count = FaceDetector(w, h, maxFaces).findFaces(rgb565, found)
            rgb565.recycle()
            val out = ArrayList<Float>()
            val mid = PointF()
            for (i in 0 until count) {
                val f = found[i] ?: continue
                if (f.confidence() < 0.4f) continue
                f.getMidPoint(mid)
                val d = f.eyesDistance()
                if (d < 6f) continue
                // 脸：眼睛中点往下 0.5 个眼距为中心，宽 ±1.1 眼距，高 ±1.35 眼距
                out += listOf(mid.x / w, (mid.y + 0.5f * d) / h, 1.1f * d / w, 1.35f * d / h)
                // 脖子：下巴下面
                out += listOf(mid.x / w, (mid.y + 2.6f * d) / h, 0.85f * d / w, 0.95f * d / h)
            }
            out.toFloatArray()
        } catch (e: Exception) {
            FloatArray(0)
        }
    }

    /** 与着色器里的 skinMask 保持一致。 */
    fun skinMask(y: Float, cb: Float, cr: Float): Float {
        val dx = (cb + 0.085f) / 0.11f
        val dy = (cr - 0.09f) / 0.085f
        var m = 1f - smoothstep(0.75f, 1.2f, sqrt(dx * dx + dy * dy))
        val hue = Math.toDegrees(atan2(cr, -cb).toDouble()).toFloat()
        m *= smoothstep(33f, 40f, hue) * (1f - smoothstep(68f, 78f, hue))
        m *= smoothstep(0.06f, 0.16f, y) * (1f - smoothstep(0.93f, 0.99f, y))
        return m
    }

    private fun percentile(hist: IntArray, total: Float, q: Float): Float {
        var acc = 0f
        for (i in hist.indices) {
            acc += hist[i]
            if (acc >= q * total) return i / 255f
        }
        return 1f
    }

    private fun smoothstep(e0: Float, e1: Float, x: Float): Float {
        val t = ((x - e0) / (e1 - e0)).coerceIn(0f, 1f)
        return t * t * (3f - 2f * t)
    }

    private fun toLinear(c: Float): Double =
        if (c <= 0.04045f) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)

    private fun Float.round1() = (this * 10f).roundToInt() / 10f
}
