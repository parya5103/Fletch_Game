package com.aaryapratik.arrowout.nativeapp.presentation.theme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
@Composable fun ArrowOutTheme(darkTheme:Boolean=true,content:@Composable ()->Unit){val scheme=if(darkTheme)darkColorScheme(primary=Color(0xFF48C6EF),background=Color(0xFF101827),surface=Color(0xFF202C40))else lightColorScheme();MaterialTheme(colorScheme=scheme,content=content)}
