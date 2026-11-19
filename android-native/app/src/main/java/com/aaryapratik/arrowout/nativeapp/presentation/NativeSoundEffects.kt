package com.aaryapratik.arrowout.nativeapp.presentation

import android.media.AudioManager
import android.media.ToneGenerator

/**
 * Small, allocation-light native feedback tones. Sound is opt-in and failures
 * are intentionally non-fatal so audio can never interrupt puzzle input.
 */
internal class NativeSoundEffects {
    private var generator: ToneGenerator? = null

    fun playMove() = play(ToneGenerator.TONE_PROP_ACK, 75)
    fun playBlocked() = play(ToneGenerator.TONE_PROP_NACK, 110)
    fun playHint() = play(ToneGenerator.TONE_PROP_BEEP2, 130)
    fun playWin() {
        play(ToneGenerator.TONE_PROP_ACK, 90)
        play(ToneGenerator.TONE_PROP_BEEP2, 140)
    }

    private fun play(tone: Int, durationMs: Int) {
        try {
            val active = generator ?: ToneGenerator(AudioManager.STREAM_MUSIC, 45).also { generator = it }
            active.startTone(tone, durationMs)
        } catch (_: RuntimeException) {
            // Optional sound must never block or crash gameplay.
        }
    }

    fun release() {
        try {
            generator?.release()
        } catch (_: RuntimeException) {
            // Best-effort release only.
        } finally {
            generator = null
        }
    }
}
