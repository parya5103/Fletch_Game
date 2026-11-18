package com.aaryapratik.arrowout.nativeapp
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import org.junit.Assert.*
import org.junit.Test
class ArrowPuzzleEngineTest{
 private val engine=ArrowPuzzleEngine()
 @Test fun initialPuzzleIsValid(){assertTrue(engine.valid(engine.newGame().board))}
 @Test fun frontArrowBlocksArrowBehindIt(){val s=engine.newGame();assertEquals(1,engine.blocker(s.board,0));assertEquals(-1,engine.blocker(s.board,1))}
 @Test fun clearFrontArrowThenBackArrowCanExit(){var s=engine.newGame();s=engine.tap(s,Cell(4,1));assertEquals(2,s.remaining);s=engine.tap(s,Cell(2,1));assertEquals(1,s.remaining)}
 @Test fun bodyProjectionDoesNotBlockHeadExitRay(){val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,2),Cell(1,2),Cell(1,1),Cell(2,1)),Direction.RIGHT,0),ArrowPiece(listOf(Cell(3,2),Cell(3,3)),Direction.DOWN,1)));assertEquals(-1,engine.blocker(board,0))}
 @Test fun malformedOverlappingPathsAreRejected(){val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,1),Cell(1,1)),Direction.RIGHT,0),ArrowPiece(listOf(Cell(0,1),Cell(0,2)),Direction.DOWN,1)));assertFalse(engine.valid(board))}
}