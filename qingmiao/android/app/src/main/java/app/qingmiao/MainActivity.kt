package app.qingmiao

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
import app.qingmiao.ui.EditorScreen
import app.qingmiao.ui.HomeScreen
import app.qingmiao.ui.QingmiaoTheme
import app.qingmiao.ui.QmColors

class MainActivity : ComponentActivity() {

    private val openUri = mutableStateOf<Uri?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) openUri.value = imageFrom(intent)
        setContent {
            QingmiaoTheme {
                Surface(Modifier.fillMaxSize(), color = QmColors.Bg, contentColor = QmColors.Ink) {
                    QingmiaoApp(openUri)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
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
private fun QingmiaoApp(openUri: MutableState<Uri?>) {
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) openUri.value = uri
    }
    val uri = openUri.value
    if (uri == null) {
        HomeScreen(onPick = {
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        })
    } else {
        key(uri) {
            EditorScreen(uri = uri, onBack = { openUri.value = null })
        }
    }
}
