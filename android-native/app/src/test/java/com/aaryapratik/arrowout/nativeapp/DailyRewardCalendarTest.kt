package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowBoard
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowPiece
import com.aaryapratik.arrowout.nativeapp.domain.model.Cell
import com.aaryapratik.arrowout.nativeapp.domain.model.Direction
import com.aaryapratik.arrowout.nativeapp.presentation.ArrowOutProgression
import org.junit.Assert.*
import org.junit.Test

class DailyRewardCalendarTest {
    @Test fun dailyRewardCanOnlyBeClaimedOnceForTheSameDate() {
        val initial = ArrowGameState(board = board(), coins = 0)
        val claimed = ArrowOutProgression.claimDailyReward(initial, "20261119")
        val duplicate = ArrowOutProgression.claimDailyReward(claimed, "20261119")
        assertEquals(10, claimed.coins)
        assertEquals(10, duplicate.coins)
        assertEquals(1, duplicate.loginRewardStreak)
    }

    @Test fun consecutiveDaysAdvanceSevenDayCalendarAndReward() {
        val dayOne = ArrowOutProgression.claimDailyReward(ArrowGameState(board = board()), "20261119")
        val dayTwo = ArrowOutProgression.claimDailyReward(dayOne, "20261120")
        assertEquals(25, dayTwo.coins)
        assertEquals(2, dayTwo.loginRewardStreak)
    }

    @Test fun missedDayResetsCalendarToFirstReward() {
        val dayOne = ArrowOutProgression.claimDailyReward(ArrowGameState(board = board()), "20261119")
        val afterGap = ArrowOutProgression.claimDailyReward(dayOne, "20261121")
        assertEquals(20, afterGap.coins)
        assertEquals(1, afterGap.loginRewardStreak)
    }

    @Test fun invalidDateCannotGrantReward() {
        val initial = ArrowGameState(board = board())
        assertEquals(initial, ArrowOutProgression.claimDailyReward(initial, "bad-date"))
    }

    private fun board() = ArrowBoard(4, 4, listOf(ArrowPiece(listOf(Cell(0, 0), Cell(1, 0)), Direction.RIGHT, 0)))
}
