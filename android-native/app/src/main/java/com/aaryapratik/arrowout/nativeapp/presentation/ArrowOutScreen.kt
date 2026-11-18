package com.aaryapratik.arrowout.nativeapp.presentation
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import com.aaryapratik.arrowout.nativeapp.presentation.theme.ArrowOutTheme
private val arrowColors=listOf(Color(0xFF48C6EF),Color(0xFFFFB454),Color(0xFF9D85FF),Color(0xFF4DD6A1),Color(0xFFFF718F))
@Composable fun ArrowOutRoute(viewModel:ArrowOutViewModel=hiltViewModel()){val state by viewModel.uiState.collectAsStateWithLifecycle();ArrowOutScreen(state,viewModel::onEvent)}
@Composable fun ArrowOutScreen(state:ArrowGameState,onEvent:(ArrowUiEvent)->Unit,modifier:Modifier=Modifier){
 val board=state.board
 Scaffold(modifier=modifier.fillMaxSize(),containerColor=Color(0xFF101827)){padding->
  Column(Modifier.fillMaxSize().padding(padding).padding(horizontal=18.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(18.dp)){
   Spacer(Modifier.height(12.dp));Text("ARROW OUT",style=MaterialTheme.typography.headlineLarge,color=Color.White)
   Text("A path puzzle",color=Color(0xFF9EB0CE))
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){Text("LEVEL 01",color=Color.White);Text("ARROWS LEFT  ${state.remaining}",color=Color.White)}
   Text(state.message,color=Color(0xFFB8C8E0),style=MaterialTheme.typography.bodyMedium)
   Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF202C40)).padding(7.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
    for(y in 0 until board.height)Row(horizontalArrangement=Arrangement.spacedBy(3.dp)){for(x in 0 until board.width){
     val piece=board.pieces.indexOfFirst{it.alive&&it.cells.contains(Cell(x,y))}
     val arrow=if(piece>=0)board.pieces[piece]else null
     val target=if(arrow==null)Color(0xFF172235)else arrowColors[arrow.colorIndex%arrowColors.size]
     val color by animateColorAsState(target,animationSpec=spring(),label="path-cell")
     Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(color).clickable{onEvent(ArrowUiEvent.TapCell(Cell(x,y)))},contentAlignment=Alignment.Center){
      if(arrow!=null){val isHead=arrow.cells.last()==Cell(x,y);Text(if(isHead)arrow.direction.glyph else "●",color=Color(0xFF132034),style=MaterialTheme.typography.titleLarge)}
     }
    }}
   }
   Button(onClick={onEvent(ArrowUiEvent.Restart)},modifier=Modifier.fillMaxWidth()){Text("Restart puzzle")}
   if(state.isSolved)Text("Great job! You cleared every arrow.",color=Color(0xFF61DDA8))
   Text("Only another arrow in the head's straight exit lane blocks a move.",color=Color(0xFF8294B3),style=MaterialTheme.typography.bodySmall)
  }
 }
}
@Preview(showBackground=true) @Composable private fun ArrowPreviewLight(){ArrowOutTheme(false){ArrowOutScreen(ArrowPuzzleEnginePreview.state,{})}}
private object ArrowPuzzleEnginePreview{val state=com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine().newGame()}
