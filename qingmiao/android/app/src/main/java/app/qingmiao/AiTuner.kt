package app.qingmiao

import android.content.Context
import android.graphics.Bitmap
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * AI 调参：一句话 → DeepSeek → 参数 JSON。
 * DeepSeek 只出参数，不碰像素；像素还是在手机 GPU 上处理。
 * 打开「上传照片」时，会把一张长边 768 的缩略图发给 deepseek-v4-flash-vision-exp 看图。
 */
object AiTuner {

    private const val PREFS = "qingmiao"
    const val TEXT_MODEL = "deepseek-flash"
    const val VISION_MODEL = "deepseek-v4-flash-vision-exp"

    fun apiKey(context: Context): String =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("dsKey", "") ?: ""

    fun setApiKey(context: Context, key: String) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("dsKey", key.trim()).apply()

    fun uploadPhoto(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("upload", true)

    fun setUploadPhoto(context: Context, on: Boolean) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("upload", on).apply()

    class Answer(val params: EditParams, val say: String)

    /** 每个可调参数：名字、范围、说明（发给模型）。 */
    private data class Field(val key: String, val min: Float, val max: Float, val desc: String,
                             val get: (EditParams) -> Float, val set: (EditParams, Float) -> EditParams)

    private val FIELDS = listOf(
        Field("smooth", 0f, 100f, "磨皮（去痘印和不平，保留毛孔）", { it.smooth }, { p, v -> p.copy(smooth = v) }),
        Field("even", 0f, 100f, "肤色均匀（去泛红、色斑）", { it.even }, { p, v -> p.copy(even = v) }),
        Field("white", 0f, 100f, "美白（皮肤提亮、去黄）", { it.white }, { p, v -> p.copy(white = v) }),
        Field("rosy", 0f, 100f, "气色（皮肤偏粉）", { it.rosy }, { p, v -> p.copy(rosy = v) }),
        Field("eyes", 0f, 100f, "亮眼", { it.eyes }, { p, v -> p.copy(eyes = v) }),
        Field("teeth", 0f, 100f, "白牙", { it.teeth }, { p, v -> p.copy(teeth = v) }),
        Field("lips", -100f, 100f, "唇色饱和度", { it.lips }, { p, v -> p.copy(lips = v) }),
        Field("underEye", 0f, 100f, "去黑眼圈", { it.underEye }, { p, v -> p.copy(underEye = v) }),
        Field("bgBlur", 0f, 100f, "背景虚化", { it.bgBlur }, { p, v -> p.copy(bgBlur = v) }),
        Field("bgDark", 0f, 100f, "背景压暗", { it.bgDark }, { p, v -> p.copy(bgDark = v) }),
        Field("brightness", -100f, 100f, "亮度", { it.brightness }, { p, v -> p.copy(brightness = v) }),
        Field("contrast", -100f, 100f, "对比", { it.contrast }, { p, v -> p.copy(contrast = v) }),
        Field("highlights", -100f, 100f, "高光（负 = 压高光）", { it.highlights }, { p, v -> p.copy(highlights = v) }),
        Field("shadows", -100f, 100f, "阴影（正 = 提暗部）", { it.shadows }, { p, v -> p.copy(shadows = v) }),
        Field("saturation", -100f, 100f, "饱和度", { it.saturation }, { p, v -> p.copy(saturation = v) }),
        Field("vibrance", -100f, 100f, "自然饱和度", { it.vibrance }, { p, v -> p.copy(vibrance = v) }),
        Field("temperature", -100f, 100f, "色温（正 = 暖/黄，负 = 冷/蓝）", { it.temperature }, { p, v -> p.copy(temperature = v) }),
        Field("tint", -100f, 100f, "色调（正 = 品红，负 = 绿）", { it.tint }, { p, v -> p.copy(tint = v) }),
        Field("clarity", -100f, 100f, "清晰度", { it.clarity }, { p, v -> p.copy(clarity = v) }),
        Field("sharpen", 0f, 100f, "锐化", { it.sharpen }, { p, v -> p.copy(sharpen = v) }),
        Field("dehaze", -100f, 100f, "去雾", { it.dehaze }, { p, v -> p.copy(dehaze = v) }),
        Field("vignette", -100f, 100f, "暗角", { it.vignette }, { p, v -> p.copy(vignette = v) }),
        Field("grain", 0f, 100f, "颗粒", { it.grain }, { p, v -> p.copy(grain = v) }),
        Field("filterStrength", 0f, 100f, "滤镜强度", { it.filterStrength }, { p, v -> p.copy(filterStrength = v) }),
    )

    private fun systemPrompt(filters: List<Filters.Filter>): String {
        val fields = FIELDS.joinToString("\n") { "- ${it.key}：${it.desc}，范围 ${it.min.toInt()}~${it.max.toInt()}" }
        val fl = filters.joinToString("、") { "${it.id}(${it.name})" }
        return """
你是修图 App「轻描」的调参助手。轻描的定位是「只改一点点」：修完像今天状态好，不像修过。
用户会说一句话（以及可能附上照片），你只输出一个 JSON 对象，不要任何其他文字：
{"adjust": {参数名: 新的绝对数值, ...}, "filter": 滤镜 id 或 null 或 "keep", "say": "给用户看的一句话（20 字以内）"}

可调参数（只写需要改的，数值是最终值，不是增量）：
$fields
滤镜 id：$fl

规则：
1. 默认温和，宁可少改；用户说「明显一点」「再多点」才加大。
2. 不做任何改变五官形状、脸型、身材的事（轻描也没有这类功能）。用户要求瘦脸、大眼、换脸、去掉某人时，adjust 留空，say 里礼貌说明做不了。
3. 「太黄了」= 色温往负、美白；「太暗」= 亮度、阴影；「发灰」= 对比、去雾；「皮肤不好」= 磨皮、肤色均匀；「日系/清新」可用 japan 滤镜等。
4. 不想换滤镜就写 "filter": "keep"。
""".trimIndent()
    }

    fun ask(
        context: Context,
        instruction: String,
        current: EditParams,
        stats: String,
        photo: Bitmap?,
    ): Answer {
        val key = apiKey(context)
        if (key.isBlank()) throw IllegalStateException("先在上面填 DeepSeek API Key")
        val filters = Filters.list(context)
        val currentJson = JSONObject().apply {
            for (f in FIELDS) put(f.key, f.get(current).roundToInt())
            put("filter", current.filter ?: JSONObject.NULL)
        }
        val userText = "当前参数：$currentJson\n照片信息：$stats\n用户说：$instruction"

        val content: Any = if (photo != null) {
            JSONArray().apply {
                put(JSONObject().put("type", "text").put("text", userText))
                put(JSONObject().put("type", "image_url").put("image_url", JSONObject().put("url", dataUrl(photo))))
            }
        } else userText
        val body = JSONObject().apply {
            put("model", if (photo != null) VISION_MODEL else TEXT_MODEL)
            put("max_tokens", 600)
            put("stream", false)
            put("response_format", JSONObject().put("type", "json_object"))
            put("messages", JSONArray().apply {
                put(JSONObject().put("role", "system").put("content", systemPrompt(filters)))
                put(JSONObject().put("role", "user").put("content", content))
            })
        }
        val text = post("https://api.deepseek.com/chat/completions", key, body.toString())
        val msg = JSONObject(text).getJSONArray("choices").getJSONObject(0)
            .getJSONObject("message").getString("content")
        return parse(msg, current, filters)
    }

    /** 三层兜底：JSON 解析失败 / 字段越界 / 滤镜 id 不存在。 */
    private fun parse(raw: String, current: EditParams, filters: List<Filters.Filter>): Answer {
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        if (start < 0 || end <= start) throw IllegalStateException("AI 没给出可用的参数，换个说法试试")
        val o = JSONObject(raw.substring(start, end + 1))
        var p = current
        val adj = o.optJSONObject("adjust")
        if (adj != null) {
            for (f in FIELDS) {
                if (!adj.has(f.key)) continue
                val v = adj.optDouble(f.key, Double.NaN)
                if (v.isNaN()) continue
                p = f.set(p, v.toFloat().coerceIn(f.min, f.max).roundToInt().toFloat())
            }
        }
        if (o.has("filter")) {
            val fid = if (o.isNull("filter")) null else o.optString("filter")
            p = when {
                fid == "keep" -> p
                fid == null || fid.isBlank() || fid == "null" -> p.copy(filter = null)
                filters.any { it.id == fid } -> p.copy(filter = fid)
                else -> p
            }
        }
        val say = o.optString("say").ifBlank { "调好了" }
        return Answer(p, say)
    }

    private fun dataUrl(photo: Bitmap): String {
        val s = 768f / max(photo.width, photo.height)
        val small = if (s < 1f) Bitmap.createScaledBitmap(
            photo, max(1, (photo.width * s).roundToInt()), max(1, (photo.height * s).roundToInt()), true
        ) else photo
        val bos = ByteArrayOutputStream()
        small.compress(Bitmap.CompressFormat.JPEG, 85, bos)
        if (small !== photo) small.recycle()
        return "data:image/jpeg;base64," + Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
    }

    private fun post(url: String, key: String, json: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15000
            conn.readTimeout = 60000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $key")
            conn.outputStream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (code !in 200..299) {
                throw IllegalStateException(
                    when (code) {
                        401 -> "API Key 不对，检查一下"
                        402 -> "DeepSeek 账户余额不足"
                        429 -> "请求太频繁，稍等再试"
                        else -> "DeepSeek 返回 $code：" + text.take(120)
                    }
                )
            }
            return text
        } finally {
            conn.disconnect()
        }
    }
}
