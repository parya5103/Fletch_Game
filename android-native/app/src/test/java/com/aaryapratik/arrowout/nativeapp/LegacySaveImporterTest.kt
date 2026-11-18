package com.aaryapratik.arrowout.nativeapp
import com.aaryapratik.arrowout.nativeapp.data.LegacySaveImporter
import org.junit.Assert.*
import org.junit.Test
class LegacySaveImporterTest{
 @Test fun importsV2ProgressAndCosmeticsSafely(){val imported=LegacySaveImporter.import("""{"v":2,"unlocked":14,"coins":420,"sound":false,"best":{"1":{"stars":3,"plays":5},"1000":{"stars":2,"plays":2},"1001":{"stars":99,"plays":99}}}""");assertEquals(2,imported.version);assertEquals(14,imported.unlocked);assertEquals(420,imported.coins);assertEquals(3,imported.bestStars[1]);assertFalse(imported.sound);assertFalse(imported.bestStars.containsKey(1001))}
 @Test fun retainsValidatedFullV2PayloadIncludingCurrentPuzzleAndSettings(){
  val json="""{"v":2,"unlocked":701,"coins":321,"best":{"700":{"stars":2,"plays":4}},"cur":{"level":77,"date":"2026-11-19","width":6,"height":6,"arrows":[{"path":[[0,0],[1,0]],"alive":true}],"hearts":3,"mistakes":0,"hints":1},"stats":{"wins":99},"achievements":{"first-win":true},"daily":{"date":"2026-11-19","completed":true},"streaks":{"current":7},"loginRewards":{"claimed":true},"bonusClaimed":{"daily":true},"music":false,"vibration":true,"theme":"dark","installHidden":true,"skin":"royal","owned":{"royal":true},"boardSkin":"galaxy","ownedBoards":{"galaxy":true},"settings":{"reducedMotion":true,"seenOnboarding":true}}"""
  val imported=LegacySaveImporter.import(json)
  assertTrue(imported.rawSaveJson.contains("\"cur\""));assertTrue(imported.rawSaveJson.contains("\"achievements\""));assertTrue(imported.rawSaveJson.contains("\"ownedBoards\""))
 }
 @Test fun rejectsUnsupportedVersionsAndOversizedPayloads(){
  assertThrows(IllegalArgumentException::class.java){LegacySaveImporter.import("""{"v":3}""")}
  assertThrows(IllegalArgumentException::class.java){LegacySaveImporter.import(" ".repeat(LegacySaveImporter.MAX_SAVE_BYTES+1))}
 }
}