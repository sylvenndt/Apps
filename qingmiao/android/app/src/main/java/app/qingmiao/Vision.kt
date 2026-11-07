package app.qingmiao

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import java.nio.ByteOrder
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 本地 AI 识别（MediaPipe，模型打包在 APK 里，不联网）：
 * - 人像多类分割：背景 / 头发 / 身体皮肤 / 面部皮肤 / 衣服 / 配饰
 * - 人脸 478 个关键点：眼睛、嘴唇、牙齿、眼下区域
 * 只用于「定位哪里该处理」，绝不用于改脸型。
 */
object Vision {

    /**
     * 识别结果，两张 RGBA 字节图（行 0 = 图片顶部）：
     * seg：R = 皮肤（脸+身体），G = 头发，B = 人（非背景），A = 面部皮肤
     * feat：R = 眼睛，G = 口腔（牙齿候选），B = 嘴唇，A = 眼下（黑眼圈）
     * faces：人脸/脖子椭圆 (cx, cy, rx, ry)，归一化坐标。
     */
    class Maps(
        val width: Int,
        val height: Int,
        val seg: ByteArray,
        val feat: ByteArray,
        val faces: FloatArray,
        val faceCount: Int,
        val hasSeg: Boolean,
    )

    private const val SEG_MODEL = "models/selfie_multiclass_256x256.tflite"
    private const val FACE_MODEL = "models/face_landmarker.task"

    fun analyze(context: Context, photo: Bitmap): Maps? {
        return try {
            val scale = min(1f, 768f / max(photo.width, photo.height))
            val w = max(8, (photo.width * scale).roundToInt())
            val h = max(8, (photo.height * scale).roundToInt())
            val src = Bitmap.createScaledBitmap(photo, w, h, true).let {
                if (it.config == Bitmap.Config.ARGB_8888) it else it.copy(Bitmap.Config.ARGB_8888, false)
            }
            val seg = segment(context, src, w, h)
            val landmarks = landmarks(context, src)
            if (src !== photo) src.recycle()
            if (seg == null && landmarks.isEmpty()) return null
            val feat = drawFeatures(landmarks, w, h)
            val faces = ArrayList<Float>()
            for (face in landmarks) faces += faceEllipses(face)
            Maps(w, h, seg ?: fallbackSeg(w, h), feat, faces.toFloatArray(), landmarks.size, seg != null)
        } catch (e: Throwable) {
            null
        }
    }

    private fun segment(context: Context, src: Bitmap, w: Int, h: Int): ByteArray? {
        return try {
            val options = ImageSegmenter.ImageSegmenterOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath(SEG_MODEL).build())
                .setRunningMode(RunningMode.IMAGE)
                .setOutputConfidenceMasks(true)
                .setOutputCategoryMask(false)
                .build()
            val segmenter = ImageSegmenter.createFromOptions(context, options)
            try {
                val result = segmenter.segment(BitmapImageBuilder(src).build())
                val masks = result.confidenceMasks().orElse(null) ?: return null
                if (masks.size < 4) return null
                val mw = masks[0].width
                val mh = masks[0].height
                val planes = masks.map { m ->
                    val fb = ByteBufferExtractor.extract(m).order(ByteOrder.nativeOrder()).asFloatBuffer()
                    FloatArray(fb.remaining()).also { fb.get(it) }
                }
                // 类别：0 背景，1 头发，2 身体皮肤，3 面部皮肤，4 衣服，5 配饰
                val out = ByteArray(w * h * 4)
                for (y in 0 until h) {
                    val sy = min(mh - 1, y * mh / h)
                    for (x in 0 until w) {
                        val sx = min(mw - 1, x * mw / w)
                        val i = sy * mw + sx
                        val bg = planes[0][i]
                        val hair = planes[1][i]
                        val body = planes[2][i]
                        val face = planes[3][i]
                        val o = (y * w + x) * 4
                        out[o] = toByte(body + face)
                        out[o + 1] = toByte(hair)
                        out[o + 2] = toByte(1f - bg)
                        out[o + 3] = toByte(face)
                    }
                }
                out
            } finally {
                segmenter.close()
            }
        } catch (e: Throwable) {
            null
        }
    }

    private fun landmarks(context: Context, src: Bitmap): List<List<NormalizedLandmark>> {
        return try {
            val options = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath(FACE_MODEL).build())
                .setRunningMode(RunningMode.IMAGE)
                .setNumFaces(6)
                .setMinFaceDetectionConfidence(0.4f)
                .setMinFacePresenceConfidence(0.4f)
                .build()
            val lm = FaceLandmarker.createFromOptions(context, options)
            try {
                lm.detect(BitmapImageBuilder(src).build()).faceLandmarks()
            } finally {
                lm.close()
            }
        } catch (e: Throwable) {
            emptyList()
        }
    }

    // —— 关键点序号（MediaPipe Face Mesh）——
    private val RIGHT_EYE_UPPER = intArrayOf(246, 161, 160, 159, 158, 157, 173)
    private val RIGHT_EYE_LOWER = intArrayOf(33, 7, 163, 144, 145, 153, 154, 155, 133)
    private val LEFT_EYE_UPPER = intArrayOf(466, 388, 387, 386, 385, 384, 398)
    private val LEFT_EYE_LOWER = intArrayOf(263, 249, 390, 373, 374, 380, 381, 382, 362)
    private val LIPS_UPPER_OUTER = intArrayOf(61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291)
    private val LIPS_LOWER_OUTER = intArrayOf(146, 91, 181, 84, 17, 314, 405, 321, 375, 291)
    private val LIPS_UPPER_INNER = intArrayOf(78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308)
    private val LIPS_LOWER_INNER = intArrayOf(78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308)
    private val RIGHT_UNDER_1 = intArrayOf(130, 25, 110, 24, 23, 22, 26, 112, 243)
    private val RIGHT_UNDER_3 = intArrayOf(143, 111, 117, 118, 119, 120, 121, 128, 245)
    private val LEFT_UNDER_1 = intArrayOf(359, 255, 339, 254, 253, 252, 256, 341, 463)
    private val LEFT_UNDER_3 = intArrayOf(372, 340, 346, 347, 348, 349, 350, 357, 465)
    private val SILHOUETTE = intArrayOf(
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
        152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
    )

    private fun drawFeatures(faces: List<List<NormalizedLandmark>>, w: Int, h: Int): ByteArray {
        val eyes = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8)
        val mouth = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8)
        val lips = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8)
        val under = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8)
        for (lm in faces) {
            if (lm.size < 468) continue
            val faceW = width(lm, SILHOUETTE) * w
            val soft = max(1f, faceW * 0.012f)
            fun poly(a: IntArray, b: IntArray): Path {
                val p = Path()
                p.moveTo(lm[a[0]].x() * w, lm[a[0]].y() * h)
                for (k in 1 until a.size) p.lineTo(lm[a[k]].x() * w, lm[a[k]].y() * h)
                for (k in b.indices.reversed()) p.lineTo(lm[b[k]].x() * w, lm[b[k]].y() * h)
                p.close()
                return p
            }
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.FILL
                maskFilter = BlurMaskFilter(soft, BlurMaskFilter.Blur.NORMAL)
            }
            // 眼睛：眼裂多描一圈，让睫毛根部的眼白也算进去
            Canvas(eyes).apply {
                val stroke = Paint(fill).apply { style = Paint.Style.FILL_AND_STROKE; strokeWidth = soft }
                drawPath(poly(RIGHT_EYE_LOWER, RIGHT_EYE_UPPER), stroke)
                drawPath(poly(LEFT_EYE_LOWER, LEFT_EYE_UPPER), stroke)
            }
            Canvas(mouth).drawPath(poly(LIPS_UPPER_INNER, LIPS_LOWER_INNER), fill)
            Canvas(lips).apply {
                drawPath(poly(LIPS_UPPER_OUTER, LIPS_LOWER_OUTER), fill)
                val clear = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    xfermode = PorterDuffXfermode(PorterDuff.Mode.CLEAR)
                }
                drawPath(poly(LIPS_UPPER_INNER, LIPS_LOWER_INNER), clear)
            }
            val underPaint = Paint(fill).apply { maskFilter = BlurMaskFilter(soft * 3f, BlurMaskFilter.Blur.NORMAL) }
            Canvas(under).apply {
                drawPath(poly(RIGHT_UNDER_1, RIGHT_UNDER_3), underPaint)
                drawPath(poly(LEFT_UNDER_1, LEFT_UNDER_3), underPaint)
            }
        }
        val out = ByteArray(w * h * 4)
        val row = IntArray(w * h)
        for ((ch, bmp) in listOf(eyes, mouth, lips, under).withIndex()) {
            bmp.getPixels(row, 0, w, 0, 0, w, h)
            for (i in row.indices) out[i * 4 + ch] = (row[i] ushr 24).toByte()
            bmp.recycle()
        }
        return out
    }

    private fun width(lm: List<NormalizedLandmark>, idx: IntArray): Float {
        var lo = 1f
        var hi = 0f
        for (i in idx) {
            lo = min(lo, lm[i].x()); hi = max(hi, lm[i].x())
        }
        return hi - lo
    }

    /** 由脸部轮廓得到脸和脖子的椭圆（没有分割模型时的兜底皮肤范围）。 */
    private fun faceEllipses(lm: List<NormalizedLandmark>): List<Float> {
        if (lm.size < 468) return emptyList()
        var x0 = 1f; var x1 = 0f; var y0 = 1f; var y1 = 0f
        for (i in SILHOUETTE) {
            x0 = min(x0, lm[i].x()); x1 = max(x1, lm[i].x())
            y0 = min(y0, lm[i].y()); y1 = max(y1, lm[i].y())
        }
        val cx = (x0 + x1) / 2; val cy = (y0 + y1) / 2
        val rx = (x1 - x0) / 2 * 1.05f; val ry = (y1 - y0) / 2 * 1.02f
        return listOf(cx, cy, rx, ry, cx, y1 + ry * 0.55f, rx * 0.75f, ry * 0.6f)
    }

    private fun fallbackSeg(w: Int, h: Int): ByteArray {
        // 没有分割结果：皮肤交给色度模型（R=0 时着色器走兜底路径由 uHasSeg 控制），人 = 全图
        val out = ByteArray(w * h * 4)
        for (i in 0 until w * h) out[i * 4 + 2] = 255.toByte()
        return out
    }

    private fun toByte(v: Float): Byte = (v.coerceIn(0f, 1f) * 255f + 0.5f).toInt().toByte()
}
