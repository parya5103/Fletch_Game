package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ArrowOutReleaseReadinessTest {
    @Test fun twentyByTwentyBoardHasACompleteValidSolutionOffline() {
        val pieces = (0 until 20).map { x ->
            ArrowPiece(listOf(Cell(x, 1), Cell(x, 0)), Direction.UP, x % 8)
        } + (0 until 20).map { x ->
            ArrowPiece(listOf(Cell(x, 18), Cell(x, 19)), Direction.DOWN, x % 8)
        }
        val state = ArrowGameState(board = ArrowBoard(20, 20, pieces))
        val engine = ArrowPuzzleEngine()
        assertTrue(engine.valid(state.board))
        val solution = engine.solution(state)
        assertEquals(pieces.size, solution.size)
        var board = state.board
        solution.forEach { index ->
            assertEquals(-1, engine.blocker(board, index))
            val remaining = board.pieces.toMutableList()
            remaining[index] = remaining[index].copy(alive = false)
            board = board.copy(pieces = remaining)
        }
        assertTrue(board.pieces.none { it.alive })
    }
}
