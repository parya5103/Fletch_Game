package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.presentation.ArrowOutWorldCatalog
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class ArrowOutWorldCatalogTest {
    @Test fun containsEightContiguousWorldsOfOneHundredTwentyFiveLevels() {
        val worlds = ArrowOutWorldCatalog.worlds
        assertEquals(8, worlds.size)
        worlds.forEachIndexed { index, world ->
            assertEquals(index + 1, world.id)
            assertEquals(125, world.lastLevel - world.firstLevel + 1)
            if (index > 0) assertEquals(worlds[index - 1].lastLevel + 1, world.firstLevel)
        }
        assertEquals(1, worlds.first().firstLevel)
        assertEquals(1000, worlds.last().lastLevel)
    }

    @Test fun everyWorldHasThreeGuardianStoryActs(){
        ArrowOutWorldCatalog.worlds.forEach { world ->
            assertEquals(3, world.storyActs.size)
            assertEquals(true, world.storyActs.all { it.isNotBlank() })
        }
    }

    @Test fun everyWorldHasStableStoryIdForSaveMigration(){
        assertEquals((1..8).toList(), ArrowOutWorldCatalog.worlds.map { it.id })
    }

    @Test fun everyCampaignBoundaryMapsToItsExpectedWorld() {
        ArrowOutWorldCatalog.worlds.forEach { world ->
            assertEquals(world.id, ArrowOutWorldCatalog.forLevel(world.firstLevel).id)
            assertEquals(world.id, ArrowOutWorldCatalog.forLevel(world.lastLevel).id)
        }
        assertNotNull(ArrowOutWorldCatalog.byId(8))
    }
}
