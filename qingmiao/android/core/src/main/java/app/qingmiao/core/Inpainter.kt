package app.qingmiao.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 消除笔：LaMa-Dilated 修补（本地运行）。
 * 只把笔迹周围一块正方形区域缩到 512×512 交给模型，补好后再按羽化的笔迹贴回原图，
 * 笔迹以外的像素一个都不动。
 */
object Inpainter {

    /** 一笔：点是归一化坐标（x 按宽、y 按高），width 是笔粗占图片宽度的比例。 */
    class Stroke(val points: List<Pair<Float, Float>>, val width: Float)

    private const val MODEL = "models/lama_dilated.tflite"

    fun run(context: Context, full: Bitmap, strokes: List<Stroke>): Bitmap {
        val w = full.width
        val h = full.height
        // 笔迹外接框（全分辨率像素）
        var x0 = Float.MAX_VALUE; var y0 = Float.MAX_VALUE; var x1 = 0f; var y1 = 0f
        for (s in strokes) {
            val r = s.width * w / 2f
            for ((px, py) in s.points) {
                x0 = min(x0, px * w - r); y0 = min(y0, py * h - r)
                x1 = max(x1, px * w + r); y1 = max(y1, py * h + r)
            }
        }
        if (x0 > x1) throw IllegalStateException("先在照片上涂掉要消除的东西")
        // 正方形裁剪区：笔迹的 1.8 倍，至少 384 px，不超过图片短边
        val side = min(min(w, h), max(384, (max(x1 - x0, y1 - y0) * 1.8f).roundToInt()))
        val cx = (x0 + x1) / 2f
        val cy = (y0 + y1) / 2f
        val left = (cx - side / 2f).roundToInt().coerceIn(0, w - side)
        val top = (cy - side / 2f).roundToInt().coerceIn(0, h - side)

        val crop = Bitmap.createBitmap(full, left, top, side, side)
        val n = 512
        val small = Bitmap.createScaledBitmap(crop, n, n, true)
        // 模型用的硬掩膜（稍微加粗，让模型把阴影边缘也补上）
        val maskSmall = drawMask(strokes, w, h, left, top, side, n, grow = 1.25f, blur = 0f)
        val painted = infer(context, small, maskSmall, n)
        small.recycle()

        // 贴回：补好的图放大回裁剪尺寸，按羽化掩膜混合
        val paintedBig = Bitmap.createScaledBitmap(painted, side, side, true)
        painted.recycle()
        val feather = drawMask(strokes, w, h, left, top, side, side, grow = 1.35f, blur = max(2f, side * 0.012f))
        val orig = IntArray(side * side)
        val fill = IntArray(side * side)
        crop.getPixels(orig, 0, side, 0, 0, side, side)
        paintedBig.getPixels(fill, 0, side, 0, 0, side, side)
        crop.recycle()
        paintedBig.recycle()
        for (i in orig.indices) {
            val a = feather[i]
            if (a <= 0f) continue
            orig[i] = mix(orig[i], fill[i], a)
        }
        val out = full.copy(Bitmap.Config.ARGB_8888, true)
        out.setPixels(orig, 0, side, left, top, side, side)
        return out
    }

    /** 把笔迹画进 size×size 的掩膜（裁剪区坐标），返回 0..1。 */
    private fun drawMask(
        strokes: List<Stroke>, w: Int, h: Int, left: Int, top: Int, side: Int, size: Int,
        grow: Float, blur: Float,
    ): FloatArray {
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ALPHA_8)
        val canvas = Canvas(bmp)
        val k = size.toFloat() / side
        for (s in strokes) {
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                strokeWidth = s.width * w * k * grow
                if (blur > 0f) maskFilter = BlurMaskFilter(blur * k, BlurMaskFilter.Blur.NORMAL)
            }
            val path = Path()
            s.points.forEachIndexed { i, (px, py) ->
                val x = (px * w - left) * k
                val y = (py * h - top) * k
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            if (s.points.size == 1) {
                val (px, py) = s.points[0]
                path.lineTo((px * w - left) * k + 0.1f, (py * h - top) * k)
            }
            canvas.drawPath(path, paint)
        }
        val px = IntArray(size * size)
        bmp.getPixels(px, 0, size, 0, 0, size, size)
        bmp.recycle()
        return FloatArray(px.size) { (px[it] ushr 24) / 255f }
    }

    private fun infer(context: Context, image: Bitmap, mask: FloatArray, n: Int): Bitmap {
        val fd = context.assets.openFd(MODEL)
        val model = FileInputStream(fd.fileDescriptor).use {
            it.channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
        }
        var gpu: GpuDelegate? = null
        val interpreter = try {
            val opts = Interpreter.Options()
            val compat = CompatibilityList()
            if (compat.isDelegateSupportedOnThisDevice) {
                gpu = GpuDelegate(compat.bestOptionsForThisDevice)
                opts.addDelegate(gpu)
            } else opts.setNumThreads(4)
            Interpreter(model, opts)
        } catch (e: Throwable) {
            gpu?.close()
            gpu = null
            Interpreter(model, Interpreter.Options().setNumThreads(4))
        }
        try {
            // 找出哪个输入是图（3 通道）、哪个是掩膜（1 通道），以及排布方式
            val inputs = Array(interpreter.inputTensorCount) { i ->
                val shape = interpreter.getInputTensor(i).shape()
                val nchw = shape.size == 4 && (shape[1] == 3 || shape[1] == 1) && shape[3] != 3 && shape[3] != 1
                val ch = if (nchw) shape[1] else shape[shape.size - 1]
                Triple(i, ch, nchw)
            }
            val px = IntArray(n * n)
            image.getPixels(px, 0, n, 0, 0, n, n)
            val buffers = arrayOfNulls<Any>(inputs.size)
            for ((i, ch, nchw) in inputs) {
                val buf = ByteBuffer.allocateDirect(n * n * ch * 4).order(ByteOrder.nativeOrder())
                val fb = buf.asFloatBuffer()
                if (ch == 1) {
                    for (v in mask) fb.put(if (v > 0.4f) 1f else 0f)
                } else if (nchw) {
                    for (c in 0 until 3) for (p in px) fb.put(chan(p, c))
                } else {
                    for (p in px) { fb.put(chan(p, 0)); fb.put(chan(p, 1)); fb.put(chan(p, 2)) }
                }
                buffers[i] = buf
            }
            val outShape = interpreter.getOutputTensor(0).shape()
            val outNchw = outShape.size == 4 && outShape[1] == 3
            val out = ByteBuffer.allocateDirect(n * n * 3 * 4).order(ByteOrder.nativeOrder())
            interpreter.runForMultipleInputsOutputs(buffers, mapOf(0 to out))
            out.rewind()
            val ob = out.asFloatBuffer()
            // 有的导出版本输出 0..255，有的是 0..1：看整体最大值决定
            var maxV = 0f
            for (i in 0 until n * n * 3) maxV = max(maxV, ob.get(i))
            val scale = if (maxV > 1.5f) 1f else 255f
            val res = IntArray(n * n)
            for (i in 0 until n * n) {
                val r: Float; val g: Float; val b: Float
                if (outNchw) {
                    r = ob.get(i); g = ob.get(n * n + i); b = ob.get(2 * n * n + i)
                } else {
                    r = ob.get(i * 3); g = ob.get(i * 3 + 1); b = ob.get(i * 3 + 2)
                }
                res[i] = argb(r * scale, g * scale, b * scale)
            }
            return Bitmap.createBitmap(res, n, n, Bitmap.Config.ARGB_8888)
        } finally {
            interpreter.close()
            gpu?.close()
        }
    }

    private fun chan(p: Int, c: Int): Float = when (c) {
        0 -> ((p shr 16) and 255) / 255f
        1 -> ((p shr 8) and 255) / 255f
        else -> (p and 255) / 255f
    }

    private fun argb(r: Float, g: Float, b: Float): Int {
        val ri = r.roundToInt().coerceIn(0, 255)
        val gi = g.roundToInt().coerceIn(0, 255)
        val bi = b.roundToInt().coerceIn(0, 255)
        return (0xFF shl 24) or (ri shl 16) or (gi shl 8) or bi
    }

    private fun mix(a: Int, b: Int, t: Float): Int {
        val u = 1f - t
        val r = (((a shr 16) and 255) * u + ((b shr 16) and 255) * t).roundToInt()
        val g = (((a shr 8) and 255) * u + ((b shr 8) and 255) * t).roundToInt()
        val bl = ((a and 255) * u + (b and 255) * t).roundToInt()
        return (0xFF shl 24) or (r shl 16) or (g shl 8) or bl
    }
}
