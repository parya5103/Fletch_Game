package com.aaryapratik.arrowout.nativeapp.presentation.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val ArrowDarkColors = darkColorScheme(
    primary = Color(0xFF48C6EF),
    secondary = Color(0xFFFFB454),
    background = Color(0xFF101827),
    surface = Color(0xFF202C40),
    surfaceVariant = Color(0xFF263751),
    onSurfaceVariant = Color(0xFF9EB0CE)
)

private val ArrowLightColors = lightColorScheme(
    primary = Color(0xFF087FA6),
    secondary = Color(0xFF9A5B00),
    background = Color(0xFFF4F7FC),
    surface = Color.White,
    surfaceVariant = Color(0xFFE4EBF5),
    onSurfaceVariant = Color(0xFF52647D)
)

@Composable
fun ArrowOutTheme(darkTheme: Boolean = true, content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (darkTheme) ArrowDarkColors else ArrowLightColors,
        content = content
    )
}
