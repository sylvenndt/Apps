package app.qingmiao.ui

import android.graphics.Bitmap
import android.graphics.ColorSpace
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.qingmiao.AiTuner
import app.qingmiao.Analyzer
import app.qingmiao.EditParams
import app.qingmiao.Filters
import app.qingmiao.ImageIO
import app.qingmiao.SliderSpec
import app.qingmiao.Tool
import app.qingmiao.Vision
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
    var committed by remember { mutableStateOf(EditParams()) }
    val undo = remember { mutableStateListOf<EditParams>() }
    val redo = remember { mutableStateListOf<EditParams>() }
    var auto by remember { mutableStateOf(EditParams()) }
    var tool by remember { mutableStateOf(Tool.AUTO) }
    var loaded by remember { mutableStateOf(false) }
    var showOriginal by remember { mutableStateOf(false) }
    var exporting by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var preview by remember { mutableStateOf<Bitmap?>(null) }
    var thumbs by remember { mutableStateOf<Map<String, Bitmap>>(emptyMap()) }
    val filters = remember { Filters.list(context) }
    var hasSeg by remember { mutableStateOf(false) }
    var stats by remember { mutableStateOf("") }
    var hasKey by remember { mutableStateOf(AiTuner.apiKey(context).isNotBlank()) }
    var upload by remember { mutableStateOf(AiTuner.uploadPhoto(context)) }
    var aiBusy by remember { mutableStateOf(false) }
    var aiReply by remember { mutableStateOf<String?>(null) }
    var faceCount by remember { mutableStateOf(0) }

    /** 只改预览（拖动中）。 */
    fun applyParams(p: EditParams) {
        params = p
        engine.update(p)
    }

    /** 记入撤销历史。 */
    fun commit(p: EditParams) {
        applyParams(p)
        if (p == committed) return
        undo.add(committed)
        if (undo.size > 60) undo.removeAt(0)
        redo.clear()
        committed = p
    }

    fun undoOnce() {
        if (undo.isEmpty()) return
        redo.add(committed)
        committed = undo.removeAt(undo.lastIndex)
        applyParams(committed)
    }

    fun redoOnce() {
        if (redo.isEmpty()) return
        undo.add(committed)
        committed = redo.removeAt(redo.lastIndex)
        applyParams(committed)
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
                val vision = Vision.analyze(context, d.bitmap)
                Triple(d, Analyzer.analyze(d.bitmap, vision), vision)
            }
        }
        result.onSuccess { (d, a, vision) ->
            preview = d.bitmap
            hasSeg = vision?.hasSeg == true
            faceCount = vision?.faceCount ?: (a.faces.size / 8)
            engine.setImage(d.bitmap, d.fullWidth, d.fullHeight, a.faces, vision)
            auto = a.params
            stats = a.stats
            commit(a.params) // 打开就是一键美化
            loaded = true
            thumbs = withContext(Dispatchers.IO) {
                runCatching { Filters.thumbnails(context, d.bitmap) }.getOrDefault(emptyMap())
            }
        }.onFailure {
            Toast.makeText(context, "打不开这张图片", Toast.LENGTH_SHORT).show()
            onBack()
        }
    }

    // 滤镜变化（包括撤销/重做带来的变化）时换查找表
    LaunchedEffect(params.filter) {
        val id = params.filter
        if (id == null) {
            engine.setLut(null)
        } else {
            val lut = withContext(Dispatchers.IO) { runCatching { Filters.loadLut(context, id) }.getOrNull() }
            engine.setLut(lut)
        }
    }

    fun askAi(text: String) {
        if (aiBusy || text.isBlank()) return
        aiBusy = true
        aiReply = if (upload) "正在上传照片给 AI 看…" else "AI 正在想…"
        val current = params
        val photo = if (upload) preview else null
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { AiTuner.ask(context, text, current, stats, photo) }
            }
            aiBusy = false
            r.onSuccess {
                commit(it.params)
                aiReply = "AI：" + it.say
            }.onFailure { e ->
                aiReply = "出错了：" + (e.message ?: e.javaClass.simpleName)
            }
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
                .imePadding()
        ) {
            // 顶栏
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onBack, enabled = !exporting) {
                    Text("返回", color = QmColors.Muted, fontSize = 16.sp)
                }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { undoOnce() }, enabled = undo.isNotEmpty() && !exporting) {
                    Text("撤销", color = if (undo.isNotEmpty()) QmColors.Ink else QmColors.Track, fontSize = 15.sp)
                }
                TextButton(onClick = { redoOnce() }, enabled = redo.isNotEmpty() && !exporting) {
                    Text("重做", color = if (redo.isNotEmpty()) QmColors.Ink else QmColors.Track, fontSize = 15.sp)
                }
                Spacer(Modifier.width(6.dp))
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
                    .padding(top = 8.dp, bottom = 4.dp)
            ) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(196.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    when (tool) {
                        Tool.AUTO -> AutoPanel(
                            params = params,
                            auto = auto,
                            onAuto = { commit(auto) },
                            onReset = { commit(EditParams()) },
                        )
                        Tool.AI -> AiPanel(
                            hasKey = hasKey,
                            upload = upload,
                            busy = aiBusy,
                            reply = aiReply,
                            onSaveKey = { k ->
                                AiTuner.setApiKey(context, k)
                                hasKey = k.isNotBlank()
                            },
                            onUpload = { on ->
                                upload = on
                                AiTuner.setUploadPhoto(context, on)
                            },
                            onAsk = { askAi(it) },
                        )
                        Tool.FILTER -> FilterPanel(
                            filters = filters,
                            thumbs = thumbs,
                            preview = preview,
                            params = params,
                            onPick = { id -> commit(params.copy(filter = id)) },
                            onStrength = { v -> applyParams(params.copy(filterStrength = v)) },
                            onDone = { commit(params) },
                        )
                        else -> Column(
                            Modifier
                                .fillMaxSize()
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 14.dp, vertical = 4.dp)
                        ) {
                            val note = when {
                                tool == Tool.BACKGROUND && !hasSeg -> "这张照片里没识别出人像，背景功能不可用"
                                tool == Tool.FACE && faceCount == 0 -> "这张照片里没识别出人脸，五官功能不起作用"
                                else -> null
                            }
                            if (note != null) Text(note, color = QmColors.Muted, fontSize = 12.sp, modifier = Modifier.padding(4.dp))
                            for (spec in tool.sliders) {
                                ParamRow(
                                    spec = spec,
                                    value = spec.get(params),
                                    onChange = { v -> applyParams(spec.set(params, v)) },
                                    onDone = { commit(params) },
                                )
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
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(horizontal = 20.dp),
    ) {
        val status = when {
            params.isOriginal -> "当前是原图"
            params == auto -> "已一键美化：按这张照片的光线、肤色、五官自动调好了"
            else -> "已手动调整"
        }
        Text(status, color = QmColors.Muted, fontSize = 13.sp, textAlign = TextAlign.Center)
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
        Text("长按照片看原图 · 点滑杆右边的数字可以归零", color = QmColors.Muted, fontSize = 12.sp)
    }
}

@Composable
private fun AiPanel(
    hasKey: Boolean,
    upload: Boolean,
    busy: Boolean,
    reply: String?,
    onSaveKey: (String) -> Unit,
    onUpload: (Boolean) -> Unit,
    onAsk: (String) -> Unit,
) {
    var text by remember { mutableStateOf("") }
    var keyInput by remember { mutableStateOf("") }
    var editingKey by remember { mutableStateOf(!hasKey) }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 2.dp)
    ) {
        if (editingKey) {
            Text("填入你的 DeepSeek API Key（platform.deepseek.com 里创建）", color = QmColors.Muted, fontSize = 12.sp)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = keyInput,
                    onValueChange = { keyInput = it },
                    singleLine = true,
                    placeholder = { Text("sk-…", fontSize = 13.sp) },
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        onSaveKey(keyInput)
                        if (keyInput.isNotBlank()) editingKey = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = QmColors.Primary, contentColor = QmColors.OnPrimary),
                ) { Text("保存") }
            }
        } else {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                singleLine = true,
                enabled = !busy,
                placeholder = { Text("说一句：太黄了 / 皮肤再好一点", fontSize = 13.sp) },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { onAsk(text) }),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = { onAsk(text) },
                enabled = !busy && text.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = QmColors.Primary, contentColor = QmColors.OnPrimary),
            ) { Text(if (busy) "…" else "发送") }
        }
        Row(
            Modifier
                .horizontalScroll(rememberScrollState())
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            for (q in listOf("太黄了", "皮肤再好一点", "白一点但别假", "更通透", "日系清新", "背景虚化", "夜景提亮", "复古胶片")) {
                Text(
                    q,
                    color = QmColors.Ink,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(QmColors.PanelHigh)
                        .clickable(enabled = !busy) {
                            text = q
                            onAsk(q)
                        }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Switch(
                checked = upload,
                onCheckedChange = onUpload,
                colors = SwitchDefaults.colors(checkedTrackColor = QmColors.Primary),
            )
            Spacer(Modifier.width(8.dp))
            Text(
                if (upload) "上传照片给 AI 看（更准，会联网发送一张缩略图）" else "不上传照片，只发文字和亮度统计",
                color = QmColors.Muted,
                fontSize = 12.sp,
                modifier = Modifier.weight(1f),
            )
            Text(
                "换 Key",
                color = QmColors.Muted,
                fontSize = 12.sp,
                modifier = Modifier
                    .clickable { editingKey = true }
                    .padding(6.dp),
            )
        }
        if (reply != null) {
            Text(reply, color = QmColors.Ink, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
        }
        }
    }
}

@Composable
private fun FilterPanel(
    filters: List<Filters.Filter>,
    thumbs: Map<String, Bitmap>,
    preview: Bitmap?,
    params: EditParams,
    onPick: (String?) -> Unit,
    onStrength: (Float) -> Unit,
    onDone: () -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        LazyRow(
            contentPadding = PaddingValues(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(top = 6.dp),
        ) {
            item {
                FilterItem("原片", preview, params.filter == null) { onPick(null) }
            }
            items(filters, key = { it.id }) { f ->
                FilterItem(f.name, thumbs[f.id], params.filter == f.id) { onPick(f.id) }
            }
        }
        Spacer(Modifier.height(10.dp))
        if (params.filter != null) {
            Box(Modifier.padding(horizontal = 14.dp)) {
                ParamRow(
                    spec = SliderSpec("强度", 0f, 100f, { it.filterStrength }, { p, v -> p.copy(filterStrength = v) }),
                    value = params.filterStrength,
                    onChange = onStrength,
                    onDone = onDone,
                    resetTo = 80f,
                )
            }
        } else {
            Text(
                "选一个滤镜试试；人像滤镜会自动避开肤色",
                color = QmColors.Muted,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            )
        }
    }
}

@Composable
private fun FilterItem(name: String, thumb: Bitmap?, selected: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(66.dp)
            .clickable(onClick = onClick),
    ) {
        Box(
            Modifier
                .size(62.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(QmColors.PanelHigh)
                .border(
                    width = if (selected) 2.dp else 0.dp,
                    color = if (selected) QmColors.Primary else Color.Transparent,
                    shape = RoundedCornerShape(10.dp),
                )
        ) {
            if (thumb != null) {
                Image(
                    bitmap = thumb.asImageBitmap(),
                    contentDescription = name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            name,
            fontSize = 12.sp,
            color = if (selected) QmColors.Primary else QmColors.Muted,
            maxLines = 1,
        )
    }
}

@Composable
private fun ParamRow(
    spec: SliderSpec,
    value: Float,
    onChange: (Float) -> Unit,
    onDone: () -> Unit,
    resetTo: Float = 0f,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .height(46.dp),
    ) {
        Text(spec.label, color = QmColors.Ink, fontSize = 14.sp, modifier = Modifier.width(66.dp))
        Slider(
            value = value,
            onValueChange = { onChange(it.roundToInt().toFloat()) },
            onValueChangeFinished = onDone,
            valueRange = spec.min..spec.max,
            colors = SliderDefaults.colors(
                thumbColor = QmColors.Primary,
                activeTrackColor = QmColors.Primary,
                inactiveTrackColor = QmColors.Track,
            ),
            modifier = Modifier.weight(1f),
        )
        val v = value.roundToInt()
        Text(
            text = if (v > 0 && spec.min < 0f) "+$v" else "$v",
            color = if (v != resetTo.roundToInt()) QmColors.Primary else QmColors.Muted,
            fontSize = 13.sp,
            textAlign = TextAlign.End,
            modifier = Modifier
                .width(44.dp)
                .clickable {
                    onChange(resetTo)
                    onDone()
                }
                .padding(vertical = 8.dp),
        )
    }
}

@Composable
private fun ToolTabs(selected: Tool, onSelect: (Tool) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 8.dp, vertical = 2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
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
