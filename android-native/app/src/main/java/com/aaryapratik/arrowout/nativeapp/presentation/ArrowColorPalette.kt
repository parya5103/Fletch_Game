package com.aaryapratik.arrowout.nativeapp.presentation

/** ARGB palettes use distinct, high-contrast hues that remain distinguishable beyond hue alone. */
internal object ArrowColorPalette {
    val standardArgb = listOf(
        0xFF48C6EF.toInt(), 0xFFFFB454.toInt(), 0xFF9D85FF.toInt(), 0xFF4DD6A1.toInt(),
        0xFFFF718F.toInt(), 0xFFFFD166.toInt(), 0xFF80ED99.toInt(), 0xFFFF8FAB.toInt()
    )

    val colorblindArgb = listOf(
        0xFF0072B2.toInt(), 0xFFE69F00.toInt(), 0xFF009E73.toInt(), 0xFFD55E00.toInt(),
        0xFF56B4E9.toInt(), 0xFFCC79A7.toInt(), 0xFFF0E442.toInt(), 0xFF333333.toInt()
    )
}
