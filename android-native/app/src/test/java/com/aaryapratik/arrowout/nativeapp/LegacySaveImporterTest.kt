package com.aaryapratik.arrowout.nativeapp
import com.aaryapratik.arrowout.nativeapp.data.LegacySaveImporter
import org.junit.Assert.*
import org.junit.Test
class LegacySaveImporterTest{
 @Test fun importsV2ProgressAndCosmeticsSafely(){val imported=LegacySaveImporter.import("""{"v":2,"unlocked":14,"coins":420,"sound":false,"best":{"1":{"stars":3,"plays":5},"1000":{"stars":2,"plays":2},"1001":{"stars":99,"plays":99}}}""");assertEquals(2,imported.version);assertEquals(14,imported.unlocked);assertEquals(420,imported.coins);assertEquals(3,imported.bestStars[1]);assertFalse(imported.sound);assertFalse(imported.bestStars.containsKey(1001))}
}