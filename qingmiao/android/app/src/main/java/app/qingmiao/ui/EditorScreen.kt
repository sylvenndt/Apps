package app.qingmiao.ui

import android.graphics.ColorSpace
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.qingmiao.Analyzer
import app.qingmiao.EditParams
import app.qingmiao.ImageIO
import app.qingmiao.SliderSpec
import app.qingmiao.Tool
import app.qingmiao.gl.EditorEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.min
import kotlin.math.roundToInt

@Composable
fun EditorScreen(uri: Uri, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val engine = remember { EditorEngine(context) }
    val main = remember { Handler(Looper.getMainLooper()) }

    var params by remember { mutableStateOf(EditParams()) }
    var auto by remember { mutableStateOf(EditParams()) }
    var tool by remember { mutableStateOf(Tool.AUTO) }
    var loaded by remember { mutableStateOf(false) }
    var showOriginal by remember { mutableStateOf(false) }
    var exporting by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }

    fun applyParams(p: EditParams) {
        params = p
        engine.update(p)
    }

    BackHandler(enabled = !exporting) { onBack() }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        engine.onError = { msg -> Toast.makeText(context, "显示出错：$msg", Toast.LENGTH_LONG).show() }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> engine.view.onPause()
                Lifecycle.Event.ON_RESUME -> engine.view.onResume()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            engine.onError = null
            engine.release()
        }
    }

    LaunchedEffect(uri) {
        val result = withContext(Dispatchers.IO) {
            runCatching {
                val d = ImageIO.decode(context, uri, min(ImageIO.PREVIEW_LONG, engine.maxTextureSize))
                d to Analyzer.analyze(d.bitmap)
            }
        }
        result.onSuccess { (d, a) ->
            engine.setImage(d.bitmap, d.fullWidth, d.fullHeight, a.faces)
            auto = a.params
            applyParams(a.params) // 默认 = 一键美化的保守档，什么都不调也能直接发
            loaded = true
        }.onFailure {
            Toast.makeText(context, "打不开这张图片", Toast.LENGTH_SHORT).show()
            onBack()
        }
    }

    fun export() {
        if (exporting || !loaded) return
        exporting = true
        progress = 0f
        val p = params
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val full = ImageIO.decode(context, uri, engine.maxTextureSize)
                    val bmp = full.bitmap
                    val w = bmp.width
                    val h = bmp.height
                    val cs = bmp.colorSpace ?: ColorSpace.get(ColorSpace.Named.SRGB)
                    val buf = engine.renderFull(bmp, p) { f -> main.post { progress = 0.1f + 0.7f * f } }
                    bmp.recycle()
                    main.post { progress = 0.85f }
                    ImageIO.save(context, uri, buf, w, h, cs, full.mime)
                }
            }
            exporting = false
            result.onSuccess {
                Toast.makeText(context, "已保存到相册 › 轻描", Toast.LENGTH_SHORT).show()
            }.onFailure { e ->
                Toast.makeText(context, "保存失败：${e.message ?: e.javaClass.simpleName}", Toast.LENGTH_LONG).show()
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .systemBarsPadding()
        ) {
            // 顶栏
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack, enabled = !exporting) {
                    Text("返回", color = QmColors.Muted, fontSize = 16.sp)
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = { export() },
                    enabled = loaded && !exporting,
                    shape = RoundedCornerShape(20.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = QmColors.Primary,
                        contentColor = QmColors.OnPrimary,
                    ),
                ) {
                    Text("保存", fontWeight = FontWeight.SemiBold)
                }
            }

            // 预览：长按看原图
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                AndroidView(factory = { engine.view }, modifier = Modifier.fillMaxSize())
                Box(
                    Modifier
                        .fillMaxSize()
                        .pointerInput(Unit) {
                            detectTapGestures(onPress = {
                                val job = scope.launch {
                                    delay(120)
                                    showOriginal = true
                                    engine.setOriginal(true)
                                }
                                tryAwaitRelease()
                                job.cancel()
                                if (showOriginal) {
                                    showOriginal = false
                                    engine.setOriginal(false)
                                }
                            })
                        }
                )
                if (showOriginal) {
                    Text(
                        "原图",
                        color = QmColors.Ink,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .padding(top = 12.dp)
                            .background(Color(0x99000000), RoundedCornerShape(50))
                            .padding(horizontal = 14.dp, vertical = 5.dp),
                    )
                }
                if (!loaded) {
                    CircularProgressIndicator(
                        color = QmColors.Primary,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
            }

            // 工具面板
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(QmColors.Panel)
                    .padding(top = 10.dp, bottom = 6.dp)
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .padding(horizontal = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    if (tool == Tool.AUTO) {
                        AutoPanel(
                            params = params,
                            auto = auto,
                            onAuto = { applyParams(auto) },
                            onReset = { applyParams(EditParams()) },
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            for (spec in tool.sliders) {
                                ParamSlider(spec, spec.get(params)) { v -> applyParams(spec.set(params, v)) }
                            }
                        }
                    }
                }
                ToolTabs(tool) { tool = it }
            }
        }

        if (exporting) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color(0xB3000000))
                    .pointerInput(Unit) { detectTapGestures { } },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("正在按原图分辨率保存…", color = QmColors.Ink, fontSize = 15.sp)
                    Spacer(Modifier.height(14.dp))
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.width(220.dp),
                        color = QmColors.Primary,
                        trackColor = QmColors.Track,
                    )
                }
            }
        }
    }
}

@Composable
private fun AutoPanel(params: EditParams, auto: EditParams, onAuto: () -> Unit, onReset: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        val status = when {
            params.isOriginal -> "当前是原图"
            params == auto -> "已一键美化：按这张照片的光线和肤色，只做了最少的调整"
            else -> "已手动调整"
        }
        Text(status, color = QmColors.Muted, fontSize = 13.sp)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = onAuto,
                shape = RoundedCornerShape(22.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = QmColors.Primary,
                    contentColor = QmColors.OnPrimary,
                ),
            ) { Text("一键美化", fontWeight = FontWeight.SemiBold) }
            OutlinedButton(onClick = onReset, shape = RoundedCornerShape(22.dp)) {
                Text("还原原图", color = QmColors.Ink)
            }
        }
        Spacer(Modifier.height(12.dp))
        Text("长按照片可以看原图", color = QmColors.Muted, fontSize = 12.sp)
    }
}

@Composable
private fun ParamSlider(spec: SliderSpec, value: Float, onChange: (Float) -> Unit) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(spec.label, color = QmColors.Ink, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            val v = value.roundToInt()
            val atLimit = value >= spec.max || (spec.min < 0f && value <= spec.min)
            Text(
                text = when {
                    atLimit -> "$v · 已到上限"
                    v > 0 && spec.min < 0f -> "+$v"
                    else -> "$v"
                },
                color = if (atLimit) QmColors.Primary else QmColors.Muted,
                fontSize = 13.sp,
                // 点数值归零
                modifier = Modifier
                    .clickable { onChange(0f) }
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        Slider(
            value = value,
            onValueChange = { onChange(it.roundToInt().toFloat()) },
            valueRange = spec.min..spec.max,
            colors = SliderDefaults.colors(
                thumbColor = QmColors.Primary,
                activeTrackColor = QmColors.Primary,
                inactiveTrackColor = QmColors.Track,
            ),
        )
    }
}

@Composable
private fun ToolTabs(selected: Tool, onSelect: (Tool) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 10.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for (t in Tool.entries) {
            val on = t == selected
            Text(
                t.label,
                color = if (on) QmColors.Primary else QmColors.Muted,
                fontSize = 15.sp,
                fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                modifier = Modifier
                    .clickable { onSelect(t) }
                    .padding(horizontal = 12.dp, vertical = 12.dp),
            )
        }
    }
}
