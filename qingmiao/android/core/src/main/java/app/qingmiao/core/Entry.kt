package app.qingmiao.core

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.core.content.IntentCompat
import app.qingmiao.core.ui.EditorScreen
import app.qingmiao.core.ui.HomeScreen
import app.qingmiao.core.ui.QingmiaoTheme
import app.qingmiao.core.ui.QmColors

/**
 * 轻描的「在线部分」入口。
 * 外壳（安装包里的 MainActivity）每次启动时下载最新的核心代码，用反射调用这里。
 * 外壳只认这两个方法的签名，改的时候不要动它们。
 */
class Entry {

    private val openUri = mutableStateOf<Uri?>(null)

    fun onCreate(activity: ComponentActivity, savedInstanceState: Bundle?, versionInfo: String) {
        activity.enableEdgeToEdge()
        if (savedInstanceState == null) openUri.value = imageFrom(activity.intent)
        activity.setContent {
            QingmiaoTheme {
                Surface(Modifier.fillMaxSize(), color = QmColors.Bg, contentColor = QmColors.Ink) {
                    QingmiaoApp(openUri, versionInfo)
                }
            }
        }
    }

    fun onNewIntent(intent: Intent) {
        imageFrom(intent)?.let { openUri.value = it }
    }

    private fun imageFrom(intent: Intent?): Uri? {
        if (intent == null) return null
        return when (intent.action) {
            Intent.ACTION_SEND -> IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
            Intent.ACTION_EDIT, Intent.ACTION_VIEW -> intent.data
            else -> null
        }
    }
}

@Composable
private fun QingmiaoApp(openUri: MutableState<Uri?>, versionInfo: String) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) openUri.value = uri
    }
    val uri = openUri.value
    if (uri == null) {
        HomeScreen(
            versionInfo = versionInfo,
            onPick = {
                picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
            },
        )
    } else {
        key(uri) {
            EditorScreen(uri = uri, onBack = { openUri.value = null })
        }
    }
}
