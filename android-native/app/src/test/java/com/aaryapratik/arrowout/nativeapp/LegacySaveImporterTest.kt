package com.aaryapratik.arrowout.nativeapp
import com.aaryapratik.arrowout.nativeapp.data.LegacySaveImporter
import org.junit.Assert.*
import org.junit.Test
class LegacySaveImporterTest{
 @Test fun importsV2ProgressAndCosmeticsSafely(){
  val imported=LegacySaveImporter.import("""{"v":2,"unlocked":14,"coins":420,"sound":false,"best":{"1":{"stars":3,"plays":5},"1000":{"stars":2,"plays":2},"1001":{"stars":99,"plays":99}}}""")
  assertEquals(2,imported.version);assertEquals(14,imported.unlocked);assertEquals(420,imported.coins);assertEquals(3,imported.bestStars[1]);assertEquals(5,imported.bestPlays[1]);assertFalse(imported.sound);assertFalse(imported.bestStars.containsKey(1001));assertEquals(14,imported.currentLevel)
 }
 @Test fun importsExactBrowserCurrentPuzzleSnapshot(){
  val json="""{"v":2,"unlocked":701,"coins":321,"best":{"700":{"stars":2,"plays":4}},"cur":{"level":77,"date":null,"cols":4,"rows":4,"shapeIdx":[0,1,8,12],"arrows":[{"cells":[{"x":0,"y":0},{"x":1,"y":0}],"dir":1,"c":2,"step":0,"alive":true},{"cells":[{"x":0,"y":2},{"x":0,"y":3}],"dir":2,"c":3,"step":1,"alive":true}],"alive":[1,1],"hearts":2,"wrong":1,"hintsUsed":1,"undoIds":[],"bonus":null},"stats":{"totalWins":99},"achievements":{"first-win":true},"daily":{"lastDate":"2026-11-19","completed":true},"streaks":{"current":7},"music":false,"vibration":true,"theme":"dark","skin":"royal","owned":{"royal":true},"boardSkin":"galaxy","ownedBoards":{"galaxy":true},"settings":{"reducedMotion":true}}"""
  val imported=LegacySaveImporter.import(json)
  assertEquals(77,imported.currentLevel);assertNotNull(imported.currentPuzzle)
  assertEquals(4,imported.currentPuzzle!!.width);assertEquals(2,imported.currentPuzzle!!.pieces.size)
  assertEquals(2,imported.hearts);assertEquals(1,imported.mistakes);assertEquals(1,imported.hintsUsed);assertEquals("20261119",imported.dailyCompletedDate);assertEquals(7,imported.dailyStreak);assertEquals(9,imported.dailyBest)
  assertTrue(imported.rawSaveJson.contains("\"achievements\""));assertTrue(imported.rawSaveJson.contains("\"ownedBoards\""))
 }
 @Test fun rejectsUnsupportedVersionsAndOversizedPayloads(){
  assertThrows(IllegalArgumentException::class.java){LegacySaveImporter.import("""{"v":3}""")}
  assertThrows(IllegalArgumentException::class.java){LegacySaveImporter.import(" ".repeat(LegacySaveImporter.MAX_SAVE_BYTES+1))}
 }
}