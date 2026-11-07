package app.qingmiao.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONArray
import kotlin.math.max
import kotlin.math.roundToInt

/** 内置滤镜：assets/luts 里的 512×512 查找表（8×8 格，每格 64×64）。 */
object Filters {

    data class Filter(val id: String, val name: String, val group: String)

    private var cache: List<Filter>? = null
    private val MONO = setOf("bw", "bwsoft", "noir")

    fun isMono(id: String?) = id != null && id in MONO

    fun list(context: Context): List<Filter> {
        cache?.let { return it }
        val text = context.assets.open("luts/index.json").bufferedReader(Charsets.UTF_8).use { it.readText() }
        val arr = JSONArray(text)
        val out = ArrayList<Filter>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            out += Filter(o.getString("id"), o.getString("name"), o.getString("group"))
        }
        cache = out
        return out
    }

    fun loadLut(context: Context, id: String): Bitmap {
        val opts = BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
            inScaled = false
        }
        return context.assets.open("luts/$id.png").use { BitmapFactory.decodeStream(it, null, opts) }
            ?: throw IllegalStateException("滤镜 $id 读取失败")
    }

    /** 用 CPU 给每个滤镜生成一张小缩略图（照片缩到 ~120 px 再查表）。 */
    fun thumbnails(context: Context, photo: Bitmap): Map<String, Bitmap> {
        val scale = 120f / max(photo.width, photo.height)
        val w = max(1, (photo.width * scale).roundToInt())
        val h = max(1, (photo.height * scale).roundToInt())
        val small = Bitmap.createScaledBitmap(photo, w, h, true)
        val src = IntArray(w * h)
        small.getPixels(src, 0, w, 0, 0, w, h)
        if (small !== photo) small.recycle()
        val lutPx = IntArray(512 * 512)
        val out = LinkedHashMap<String, Bitmap>()
        for (f in list(context)) {
            val lut = loadLut(context, f.id)
            lut.getPixels(lutPx, 0, 512, 0, 0, 512, 512)
            lut.recycle()
            val dst = IntArray(w * h)
            for (i in src.indices) {
                val p = src[i]
                val r = (((p shr 16) and 255) * 63 + 127) / 255
                val g = (((p shr 8) and 255) * 63 + 127) / 255
                val b = ((p and 255) * 63 + 127) / 255
                val x = (b % 8) * 64 + r
                val y = (b / 8) * 64 + g
                dst[i] = lutPx[y * 512 + x] or (0xFF shl 24)
            }
            out[f.id] = Bitmap.createBitmap(dst, w, h, Bitmap.Config.ARGB_8888)
        }
        return out
    }
}
