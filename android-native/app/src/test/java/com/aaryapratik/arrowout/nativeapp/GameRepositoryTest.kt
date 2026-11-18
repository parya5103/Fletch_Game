package com.aaryapratik.arrowout.nativeapp
import com.google.gson.JsonSyntaxException
import com.aaryapratik.arrowout.nativeapp.data.GameRepository
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgress
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgressDao
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertThrows
import org.junit.Test
class GameRepositoryTest{
 @Test fun malformedStoredPuzzleIsReportedInsteadOfSilentlyStartingFresh()=runBlocking{
  val dao=mockk<GameProgressDao>()
  coEvery{dao.get("arrow-out")} returns GameProgress("arrow-out","{broken",1L)
  val repository=GameRepository(dao)
  assertThrows(JsonSyntaxException::class.java){runBlocking{repository.load()}}
 }
}