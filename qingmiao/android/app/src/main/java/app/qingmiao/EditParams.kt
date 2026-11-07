package app.qingmiao

/**
 * 一次编辑的完整状态（滑杆数值）。
 * 正负滑杆范围 -100..100，单向滑杆 0..100；真正作用到像素上的硬上限在 gl/Pipeline.kt 的 Uniforms 里。
 */
data class EditParams(
    val smooth: Float = 0f,       // 磨皮 0..100
    val even: Float = 0f,         // 肤色均匀 0..100
    val skinBright: Float = 0f,   // 肤色提亮 0..100
    val brightness: Float = 0f,   // 亮度 -100..100
    val contrast: Float = 0f,     // 对比 -100..100
    val temperature: Float = 0f,  // 色温 -100..100（正 = 暖）
    val tint: Float = 0f,         // 色调 -100..100（正 = 偏品红，负 = 偏绿）
    val clarity: Float = 0f,      // 清晰度 -100..100
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
    val hintLow: String = "",
    val hintHigh: String = "",
)

enum class Tool(val label: String) {
    AUTO("一键美化"),
    SMOOTH("磨皮"),
    SKIN("肤色"),
    LIGHT("光影"),
    COLOR("色彩"),
    CLARITY("清晰度");

    /** v1 一共 8 根滑杆 + 一键美化按钮。 */
    val sliders: List<SliderSpec>
        get() = when (this) {
            AUTO -> emptyList()
            SMOOTH -> listOf(
                SliderSpec("磨皮", 0f, 100f, { it.smooth }, { p, v -> p.copy(smooth = v) }),
            )
            SKIN -> listOf(
                SliderSpec("肤色均匀", 0f, 100f, { it.even }, { p, v -> p.copy(even = v) }),
                SliderSpec("肤色提亮", 0f, 100f, { it.skinBright }, { p, v -> p.copy(skinBright = v) }),
            )
            LIGHT -> listOf(
                SliderSpec("亮度", -100f, 100f, { it.brightness }, { p, v -> p.copy(brightness = v) }, "暗", "亮"),
                SliderSpec("对比", -100f, 100f, { it.contrast }, { p, v -> p.copy(contrast = v) }, "柔", "硬"),
            )
            COLOR -> listOf(
                SliderSpec("色温", -100f, 100f, { it.temperature }, { p, v -> p.copy(temperature = v) }, "冷", "暖"),
                SliderSpec("色调", -100f, 100f, { it.tint }, { p, v -> p.copy(tint = v) }, "绿", "品红"),
            )
            CLARITY -> listOf(
                SliderSpec("清晰度", -100f, 100f, { it.clarity }, { p, v -> p.copy(clarity = v) }, "柔和", "通透"),
            )
        }
}
