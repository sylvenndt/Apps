package app.qingmiao.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object QmColors {
    val Bg = Color(0xFF121012)
    val Panel = Color(0xFF1C191B)
    val PanelHigh = Color(0xFF272326)
    val Track = Color(0xFF3A3437)
    val Ink = Color(0xFFF3EDEA)
    val Muted = Color(0xFFA39893)
    val Primary = Color(0xFFFF8158)
    val OnPrimary = Color(0xFF2A120A)
}

@Composable
fun QingmiaoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = QmColors.Primary,
            onPrimary = QmColors.OnPrimary,
            background = QmColors.Bg,
            onBackground = QmColors.Ink,
            surface = QmColors.Panel,
            onSurface = QmColors.Ink,
            surfaceVariant = QmColors.PanelHigh,
            onSurfaceVariant = QmColors.Muted,
            outline = QmColors.Track,
        ),
        content = content,
    )
}
