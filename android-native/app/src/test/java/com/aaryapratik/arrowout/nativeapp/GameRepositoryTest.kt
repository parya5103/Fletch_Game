package com.aaryapratik.arrowout.nativeapp
import com.google.gson.JsonSyntaxException
import com.aaryapratik.arrowout.nativeapp.data.ArrowLevelCatalog
import com.aaryapratik.arrowout.nativeapp.data.GameRepository
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgress
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgressDao
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
class GameRepositoryTest{
 @Test fun malformedStoredPuzzleIsReportedInsteadOfSilentlyStartingFresh()=runBlocking{
  val dao=mockk<GameProgressDao>()
  val levels=mockk<ArrowLevelCatalog>()
  coEvery{dao.get("arrow-out")} returns GameProgress("arrow-out","{broken",1L)
  val repository=GameRepository(dao,levels)
  assertThrows(JsonSyntaxException::class.java){runBlocking{repository.load()}}
 }
 @Test fun startingAnotherLevelClearsThePreviousPuzzleHint(){
  val dao=mockk<GameProgressDao>()
  val levels=mockk<ArrowLevelCatalog>()
  val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,0)))
  every{levels.boardFor(2)} returns board
  val repository=GameRepository(dao,levels)
  val previous=ArrowGameState(board=board,level=1,hintedPieceIndex=0,hintsUsed=1)
  val next=repository.newGame(2,previous)
  assertEquals(2,next.level)
  assertEquals(-1,next.hintedPieceIndex)
  assertEquals(0,next.hintsUsed)
 }
}
