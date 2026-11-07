package app.qingmiao.core

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.CompatibilityList
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * AI 画质增强（Real-ESRGAN，本地运行，模型打包在 APK 里）。
 * 只给「本来就不清楚」的图用：微信压缩图、截图、老照片。
 * 分块推理：块之间重叠 16 px，每块只取中间那部分，接缝看不出来。
 */
object Enhancer {

    enum class Mode(val label: String, val desc: String, val model: String, val scale: Int, val maxInputLong: Int) {
        RESTORE("画质修复", "去压缩块、去噪、去糊，尺寸不变", "models/realesrgan_general_x4v3.tflite", 1, 2400),
        UPSCALE2("放大 2 倍", "快速，适合截图和网图", "models/realesrgan_general_x4v3.tflite", 2, 2048),
        UPSCALE4("放大 4 倍 · 精细", "大模型，适合老照片，较慢", "models/realesrgan_x4plus.tflite", 4, 1024),
    }

    fun available(mode: Mode, width: Int, height: Int) = max(width, height) <= mode.maxInputLong

    /** 在后台线程调用。返回新的 ARGB_8888（sRGB）位图。 */
    fun run(context: Context, src: Bitmap, mode: Mode, onProgress: (Float) -> Unit): Bitmap {
        val model = loadModel(context, mode.model)
        var gpu: GpuDelegate? = null
        val options = Interpreter.Options()
        try {
            val compat = CompatibilityList()
            if (compat.isDelegateSupportedOnThisDevice) {
                gpu = GpuDelegate(compat.bestOptionsForThisDevice)
                options.addDelegate(gpu)
            } else {
                options.setNumThreads(4)
            }
        } catch (e: Throwable) {
            gpu = null
            options.setNumThreads(4)
        }
        val interpreter = try {
            Interpreter(model, options)
        } catch (e: Throwable) {
            // GPU 不支持这个模型就退回 CPU
            gpu?.close()
            gpu = null
            Interpreter(model, Interpreter.Options().setNumThreads(4))
        }
        try {
            return process(interpreter, src, mode, onProgress)
        } finally {
            interpreter.close()
            gpu?.close()
        }
    }

    private fun process(interpreter: Interpreter, src: Bitmap, mode: Mode, onProgress: (Float) -> Unit): Bitmap {
        val inShape = interpreter.getInputTensor(0).shape()   // [1,T,T,3] 或 [1,3,T,T]
        val outShape = interpreter.getOutputTensor(0).shape()
        val nchw = inShape.size == 4 && inShape[1] == 3
        val th = if (nchw) inShape[2] else inShape[1]
        val tw = if (nchw) inShape[3] else inShape[2]
        val outH = if (nchw) outShape[2] else outShape[1]
        val up = outH / th                                     // 模型自身的放大倍数（4）
        val s = mode.scale
        val down = up / s                                      // 模型输出再缩小多少倍

        val w = src.width
        val h = src.height
        val px = IntArray(w * h)
        src.getPixels(px, 0, w, 0, 0, w, h)
        val ow = w * s
        val oh = h * s
        val out = IntArray(ow * oh)

        val margin = 16
        val xs = starts(w, tw, margin)
        val ys = starts(h, th, margin)
        val input = ByteBuffer.allocateDirect(tw * th * 3 * 4).order(ByteOrder.nativeOrder())
        val output = ByteBuffer.allocateDirect(tw * up * th * up * 3 * 4).order(ByteOrder.nativeOrder())
        val total = xs.size * ys.size
        var done = 0
        for ((yi, y0) in ys.withIndex()) {
            val ry0 = if (yi == 0) 0 else (y0 + ys[yi - 1] + th) / 2
            val ry1 = if (yi == ys.lastIndex) h else (ys[yi + 1] + y0 + th) / 2
            for ((xi, x0) in xs.withIndex()) {
                val rx0 = if (xi == 0) 0 else (x0 + xs[xi - 1] + tw) / 2
                val rx1 = if (xi == xs.lastIndex) w else (xs[xi + 1] + x0 + tw) / 2
                // 填输入（越界的地方复制边缘像素）
                input.rewind()
                val fb = input.asFloatBuffer()
                if (nchw) {
                    for (c in 0 until 3) for (yy in 0 until th) for (xx in 0 until tw) {
                        val p = px[min(h - 1, y0 + yy) * w + min(w - 1, x0 + xx)]
                        fb.put(channel(p, c))
                    }
                } else {
                    for (yy in 0 until th) for (xx in 0 until tw) {
                        val p = px[min(h - 1, y0 + yy) * w + min(w - 1, x0 + xx)]
                        fb.put(channel(p, 0)); fb.put(channel(p, 1)); fb.put(channel(p, 2))
                    }
                }
                output.rewind()
                interpreter.run(input, output)
                output.rewind()
                val ob = output.asFloatBuffer()
                val otw = tw * up
                val oth = th * up
                // 只写这块负责的区域；需要缩小时按 down×down 求平均
                for (oy in ry0 * s until ry1 * s) {
                    val ly = oy * down - y0 * up
                    for (ox in rx0 * s until rx1 * s) {
                        val lx = ox * down - x0 * up
                        var r = 0f; var g = 0f; var b = 0f
                        for (dy in 0 until down) for (dx in 0 until down) {
                            val yy = min(oth - 1, ly + dy)
                            val xx = min(otw - 1, lx + dx)
                            if (nchw) {
                                r += ob.get(yy * otw + xx)
                                g += ob.get(oth * otw + yy * otw + xx)
                                b += ob.get(2 * oth * otw + yy * otw + xx)
                            } else {
                                val i = (yy * otw + xx) * 3
                                r += ob.get(i); g += ob.get(i + 1); b += ob.get(i + 2)
                            }
                        }
                        val n = (down * down).toFloat()
                        out[oy * ow + ox] = argb(r / n, g / n, b / n)
                    }
                }
                done++
                onProgress(done.toFloat() / total)
            }
        }
        return Bitmap.createBitmap(out, ow, oh, Bitmap.Config.ARGB_8888)
    }

    private fun starts(size: Int, tile: Int, margin: Int): IntArray {
        if (size <= tile) return intArrayOf(0)
        val step = tile - 2 * margin
        val list = ArrayList<Int>()
        var p = 0
        while (p + tile < size) {
            list += p
            p += step
        }
        list += size - tile
        return list.distinct().toIntArray()
    }

    private fun channel(p: Int, c: Int): Float = when (c) {
        0 -> ((p shr 16) and 255) / 255f
        1 -> ((p shr 8) and 255) / 255f
        else -> (p and 255) / 255f
    }

    private fun argb(r: Float, g: Float, b: Float): Int {
        val ri = (r.coerceIn(0f, 1f) * 255f).roundToInt()
        val gi = (g.coerceIn(0f, 1f) * 255f).roundToInt()
        val bi = (b.coerceIn(0f, 1f) * 255f).roundToInt()
        return (0xFF shl 24) or (ri shl 16) or (gi shl 8) or bi
    }

    private fun loadModel(context: Context, path: String): MappedByteBuffer {
        val fd = context.assets.openFd(path)
        FileInputStream(fd.fileDescriptor).use { stream ->
            return stream.channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
        }
    }
}
