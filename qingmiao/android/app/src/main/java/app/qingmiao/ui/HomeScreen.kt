package app.qingmiao.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.qingmiao.R

@Composable
fun HomeScreen(onPick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(horizontal = 28.dp, vertical = 20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.weight(1f))
        Image(
            painter = painterResource(R.drawable.logo),
            contentDescription = null,
            modifier = Modifier.size(112.dp),
        )
        Spacer(Modifier.height(28.dp))
        Text("轻描", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = QmColors.Ink)
        Spacer(Modifier.height(6.dp))
        Text("只改一点点", fontSize = 18.sp, color = QmColors.Muted)
        Spacer(Modifier.height(18.dp))
        Text(
            "修完像「今天状态好」，不像「修过」",
            fontSize = 14.sp,
            color = QmColors.Muted,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1.2f))
        Button(
            onClick = onPick,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            shape = RoundedCornerShape(28.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = QmColors.Primary,
                contentColor = QmColors.OnPrimary,
            ),
        ) {
            Text("选一张照片", fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "照片只在这台手机上处理：不联网、不上传",
            fontSize = 12.sp,
            color = QmColors.Muted,
        )
        Spacer(Modifier.height(8.dp))
    }
}
