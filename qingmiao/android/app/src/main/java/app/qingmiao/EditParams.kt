package app.qingmiao

/**
 * 一次编辑的完整状态（滑杆数值）。
 * 正负滑杆范围 -100..100，单向滑杆 0..100；真正作用到像素上的强度在 gl/Pipeline.kt 的 Uniforms 里。
 */
data class EditParams(
    // 人像
    val smooth: Float = 0f,       // 磨皮
    val even: Float = 0f,         // 肤色均匀
    val white: Float = 0f,        // 美白
    val rosy: Float = 0f,         // 气色
    // 光影
    val brightness: Float = 0f,   // 亮度
    val contrast: Float = 0f,     // 对比
    val highlights: Float = 0f,   // 高光
    val shadows: Float = 0f,      // 阴影
    // 色彩
    val saturation: Float = 0f,   // 饱和度
    val vibrance: Float = 0f,     // 自然饱和度
    val temperature: Float = 0f,  // 色温（正 = 暖）
    val tint: Float = 0f,         // 色调（正 = 偏品红）
    // 细节
    val clarity: Float = 0f,      // 清晰度
    val sharpen: Float = 0f,      // 锐化
    val dehaze: Float = 0f,       // 去雾
    // 效果
    val vignette: Float = 0f,     // 暗角
    val grain: Float = 0f,        // 颗粒
    // 滤镜
    val filter: String? = null,
    val filterStrength: Float = 80f,
) {
    val isOriginal get() = this == EditParams()
}

/** 一个滑杆的定义。 */
data class SliderSpec(
    val label: String,
    val min: Float,
    val max: Float,
    val get: (EditParams) -> Float,
    val set: (EditParams, Float) -> EditParams,
)

private fun pos(label: String, get: (EditParams) -> Float, set: (EditParams, Float) -> EditParams) =
    SliderSpec(label, 0f, 100f, get, set)

private fun bi(label: String, get: (EditParams) -> Float, set: (EditParams, Float) -> EditParams) =
    SliderSpec(label, -100f, 100f, get, set)

enum class Tool(val label: String) {
    AUTO("一键美化"),
    FILTER("滤镜"),
    PORTRAIT("人像"),
    LIGHT("光影"),
    COLOR("色彩"),
    DETAIL("细节"),
    EFFECT("效果");

    val sliders: List<SliderSpec>
        get() = when (this) {
            AUTO, FILTER -> emptyList()
            PORTRAIT -> listOf(
                pos("磨皮", { it.smooth }, { p, v -> p.copy(smooth = v) }),
                pos("肤色均匀", { it.even }, { p, v -> p.copy(even = v) }),
                pos("美白", { it.white }, { p, v -> p.copy(white = v) }),
                pos("气色", { it.rosy }, { p, v -> p.copy(rosy = v) }),
            )
            LIGHT -> listOf(
                bi("亮度", { it.brightness }, { p, v -> p.copy(brightness = v) }),
                bi("对比", { it.contrast }, { p, v -> p.copy(contrast = v) }),
                bi("高光", { it.highlights }, { p, v -> p.copy(highlights = v) }),
                bi("阴影", { it.shadows }, { p, v -> p.copy(shadows = v) }),
            )
            COLOR -> listOf(
                bi("饱和度", { it.saturation }, { p, v -> p.copy(saturation = v) }),
                bi("自然饱和", { it.vibrance }, { p, v -> p.copy(vibrance = v) }),
                bi("色温", { it.temperature }, { p, v -> p.copy(temperature = v) }),
                bi("色调", { it.tint }, { p, v -> p.copy(tint = v) }),
            )
            DETAIL -> listOf(
                bi("清晰度", { it.clarity }, { p, v -> p.copy(clarity = v) }),
                pos("锐化", { it.sharpen }, { p, v -> p.copy(sharpen = v) }),
                bi("去雾", { it.dehaze }, { p, v -> p.copy(dehaze = v) }),
            )
            EFFECT -> listOf(
                bi("暗角", { it.vignette }, { p, v -> p.copy(vignette = v) }),
                pos("颗粒", { it.grain }, { p, v -> p.copy(grain = v) }),
            )
        }
}
