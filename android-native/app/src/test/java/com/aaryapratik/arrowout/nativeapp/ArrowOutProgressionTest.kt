package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowBoard
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowPiece
import com.aaryapratik.arrowout.nativeapp.domain.model.Cell
import com.aaryapratik.arrowout.nativeapp.domain.model.Direction
import com.aaryapratik.arrowout.nativeapp.presentation.ArrowOutProgression
import com.aaryapratik.arrowout.nativeapp.presentation.ArrowSkinCatalog
import org.junit.Assert.*
import org.junit.Test

class ArrowOutProgressionTest {
    @Test fun defaultSkinIsFreeAndAvailableToEverySave() {
        val state = ArrowGameState(board = board())
        assertEquals("classic", state.selectedArrowSkin)
        assertTrue(state.unlockedArrowSkins.contains("classic"))
        assertEquals(0, ArrowSkinCatalog.byId("classic")!!.cost)
    }

    @Test fun premiumSkinsHaveUniqueIdsAndNonNegativePrices() {
        val skins = ArrowSkinCatalog.all
        assertEquals(skins.size, skins.map { it.id }.distinct().size)
        assertTrue(skins.all { it.cost >= 0 && it.colors.size >= 4 })
    }

    @Test fun achievementProgressReflectsCampaignAndDailyMilestones() {
        val state = ArrowGameState(
            board = board(),
            unlockedLevel = 126,
            coins = 120,
            bestStars = (1..25).associateWith { 3 },
            dailyStreak = 7,
            dailyBest = 7
        )
        val achievements = ArrowOutProgression.achievements(state)
        assertTrue(achievements.first { it.id == "first_clear" }.unlocked)
        assertTrue(achievements.first { it.id == "world_one" }.unlocked)
        assertTrue(achievements.first { it.id == "streak_seven" }.unlocked)
        assertTrue(achievements.first { it.id == "coin_hoarder" }.unlocked)
    }

    @Test fun purchaseUsesCoinsAndPersistsUnlockedSelectionInState() {
        val initial = ArrowGameState(board = board(), coins = 100)
        val purchased = ArrowOutProgression.purchase(initial, "aurora")
        assertEquals(25, purchased.coins)
        assertTrue(purchased.unlockedArrowSkins.contains("aurora"))
        assertEquals("aurora", purchased.selectedArrowSkin)
    }

    @Test fun purchaseCannotSpendCoinsTwiceOrEquipLockedSkins() {
        val initial = ArrowGameState(board = board(), coins = 100)
        val purchased = ArrowOutProgression.purchase(initial, "aurora")
        val duplicate = ArrowOutProgression.purchase(purchased, "aurora")
        assertEquals(25, duplicate.coins)
        assertEquals("aurora", duplicate.selectedArrowSkin)
        val locked = ArrowOutProgression.select(initial, "ember")
        assertEquals("classic", locked.selectedArrowSkin)
    }

    private fun board() = ArrowBoard(4, 4, listOf(
        ArrowPiece(listOf(Cell(0, 0), Cell(1, 0)), Direction.RIGHT, 0)
    ))
}
