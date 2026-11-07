package app.qingmiao.core

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.nio.ByteBuffer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** 解码与保存。照片只在本机处理，不经过任何网络。 */
object ImageIO {

    /** 预览图的长边上限：够屏幕看清，又能让滑杆拖动保持 60 帧。 */
    const val PREVIEW_LONG = 2048

    /** 导出时的像素上限（约 5000 万像素），超过会等比缩小以免内存不够。 */
    private const val MAX_PIXELS = 50_000_000L

    class Decoded(val bitmap: Bitmap, val fullWidth: Int, val fullHeight: Int, val mime: String)

    private val P3: ColorSpace = ColorSpace.get(ColorSpace.Named.DISPLAY_P3)
    private val SRGB: ColorSpace = ColorSpace.get(ColorSpace.Named.SRGB)

    /**
     * 解码。maxLong = 输出长边上限；maxPixels = 总像素上限。
     * 色彩空间：sRGB 和 Display P3 原样保留（不压缩色域），其他少见的空间转成 sRGB。
     * EXIF 方向由 ImageDecoder 直接摆正（不需要再旋转、再压缩一次）。
     */
    fun decode(context: Context, uri: Uri, maxLong: Int, maxPixels: Long = MAX_PIXELS): Decoded {
        var fullW = 0
        var fullH = 0
        var mime = "image/jpeg"
        val source = ImageDecoder.createSource(context.contentResolver, uri)
        val decoded = ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.isMutableRequired = false
            fullW = info.size.width
            fullH = info.size.height
            mime = info.mimeType ?: mime
            var scale = 1.0
            val long = max(fullW, fullH)
            if (long > maxLong) scale = maxLong.toDouble() / long
            val pixels = fullW.toLong() * fullH
            if (pixels * scale * scale > maxPixels) scale = sqrt(maxPixels.toDouble() / pixels)
            if (scale < 1.0) {
                decoder.setTargetSize(
                    max(1, (fullW * scale).roundToInt()),
                    max(1, (fullH * scale).roundToInt()),
                )
            }
            val cs = info.colorSpace
            val target = when {
                cs == null -> SRGB
                cs == P3 -> P3
                cs.isSrgb -> cs
                else -> SRGB
            }
            decoder.setTargetColorSpace(target)
        }
        val bmp = if (decoded.config == Bitmap.Config.ARGB_8888) decoded else {
            // 10-bit HEIC 等会解成其他格式，这里统一成 8-bit 上传显存；后续运算在 16-bit 浮点里做
            val c = decoded.copy(Bitmap.Config.ARGB_8888, false)
            decoded.recycle()
            c
        }
        return Decoded(bmp, fullW, fullH, mime)
    }

    /**
     * 把渲染好的 RGBA 数据保存到相册「Pictures/轻描」。
     * PNG 原图存 PNG，其余存 JPEG（质量 95）；保留拍摄时间、机型、镜头等 EXIF，去掉 GPS 位置。
     */
    fun save(
        context: Context,
        sourceUri: Uri,
        rgba: ByteBuffer,
        width: Int,
        height: Int,
        colorSpace: ColorSpace,
        sourceMime: String,
    ): String {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888, false, colorSpace)
        rgba.position(0)
        bitmap.copyPixelsFromBuffer(rgba)

        val png = sourceMime == "image/png"
        val ext = if (png) "png" else "jpg"
        val mime = if (png) "image/png" else "image/jpeg"
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val name = "轻描_$stamp.$ext"

        val tmp = File(context.cacheDir, "export.$ext")
        try {
            tmp.outputStream().use { os ->
                val ok = bitmap.compress(
                    if (png) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG,
                    95,
                    os,
                )
                if (!ok) throw IllegalStateException("编码失败")
            }
            bitmap.recycle()
            if (!png) copyExif(context, sourceUri, tmp)

            val resolver = context.contentResolver
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, name)
                put(MediaStore.Images.Media.MIME_TYPE, mime)
                put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/轻描")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
            val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            val target = resolver.insert(collection, values)
                ?: throw IllegalStateException("相册没有空间或不可写")
            try {
                resolver.openOutputStream(target)?.use { out ->
                    tmp.inputStream().use { it.copyTo(out) }
                } ?: throw IllegalStateException("无法写入相册")
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(target, values, null, null)
            } catch (e: Exception) {
                resolver.delete(target, null, null)
                throw e
            }
            return name
        } finally {
            tmp.delete()
        }
    }

    private val EXIF_TAGS = arrayOf(
        ExifInterface.TAG_DATETIME,
        ExifInterface.TAG_DATETIME_ORIGINAL,
        ExifInterface.TAG_DATETIME_DIGITIZED,
        ExifInterface.TAG_OFFSET_TIME,
        ExifInterface.TAG_OFFSET_TIME_ORIGINAL,
        ExifInterface.TAG_OFFSET_TIME_DIGITIZED,
        ExifInterface.TAG_SUBSEC_TIME,
        ExifInterface.TAG_SUBSEC_TIME_ORIGINAL,
        ExifInterface.TAG_SUBSEC_TIME_DIGITIZED,
        ExifInterface.TAG_MAKE,
        ExifInterface.TAG_MODEL,
        ExifInterface.TAG_LENS_MAKE,
        ExifInterface.TAG_LENS_MODEL,
        ExifInterface.TAG_F_NUMBER,
        ExifInterface.TAG_EXPOSURE_TIME,
        ExifInterface.TAG_PHOTOGRAPHIC_SENSITIVITY,
        ExifInterface.TAG_FOCAL_LENGTH,
        ExifInterface.TAG_FOCAL_LENGTH_IN_35MM_FILM,
        ExifInterface.TAG_EXPOSURE_BIAS_VALUE,
        ExifInterface.TAG_EXPOSURE_PROGRAM,
        ExifInterface.TAG_METERING_MODE,
        ExifInterface.TAG_WHITE_BALANCE,
        ExifInterface.TAG_FLASH,
    )

    private fun copyExif(context: Context, sourceUri: Uri, target: File) {
        try {
            val src = context.contentResolver.openInputStream(sourceUri)?.use { ExifInterface(it) } ?: return
            val dst = ExifInterface(target.absolutePath)
            for (tag in EXIF_TAGS) {
                src.getAttribute(tag)?.let { dst.setAttribute(tag, it) }
            }
            dst.setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL.toString())
            dst.setAttribute(ExifInterface.TAG_SOFTWARE, "Qingmiao")
            dst.saveAttributes()
        } catch (ignored: Exception) {
            // EXIF 只是锦上添花，读不到就不写
        }
    }
}
