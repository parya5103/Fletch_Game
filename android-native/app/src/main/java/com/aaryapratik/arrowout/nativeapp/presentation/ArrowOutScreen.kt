package com.aaryapratik.arrowout.nativeapp.presentation
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import com.aaryapratik.arrowout.nativeapp.presentation.theme.ArrowOutTheme
private val arrowColors=listOf(Color(0xFF48C6EF),Color(0xFFFFB454),Color(0xFF9D85FF),Color(0xFF4DD6A1),Color(0xFFFF718F))
@Composable fun ArrowOutRoute(viewModel:ArrowOutViewModel=hiltViewModel(),privacyOptionsRequired:Boolean=false,onShowPrivacyOptions:()->Unit={}){
 val state by viewModel.uiState.collectAsStateWithLifecycle()
 val restoring by viewModel.isRestoring.collectAsStateWithLifecycle()
 val importMessage by viewModel.importMessage.collectAsStateWithLifecycle()
 ArrowOutScreen(state,viewModel::onEvent,privacyOptionsRequired=privacyOptionsRequired,onShowPrivacyOptions=onShowPrivacyOptions,isRestoring=restoring,onImportSave=viewModel::importLegacy,importMessage=importMessage)
}
@Composable fun ArrowOutScreen(
 state:ArrowGameState,
 onEvent:(ArrowUiEvent)->Unit,
 modifier:Modifier=Modifier,
 privacyOptionsRequired:Boolean=false,
 onShowPrivacyOptions:()->Unit={},
 isRestoring:Boolean=false,
 onImportSave:(String)->Unit={},
 importMessage:String=""
){
 val board=state.board
 val haptics=LocalHapticFeedback.current
 var showImport by remember{mutableStateOf(false)}
 var importText by remember{mutableStateOf("")}
 Scaffold(modifier=modifier.fillMaxSize(),containerColor=Color(0xFF101827)){padding->
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(horizontal=18.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(14.dp)){
   Spacer(Modifier.height(12.dp));Text("ARROW OUT",style=MaterialTheme.typography.headlineLarge,color=Color.White)
   Text("A path puzzle",color=Color(0xFF9EB0CE))
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
    Text("LEVEL ${state.level.toString().padStart(3,'0')}",color=Color.White)
    Text("♥ ${state.hearts}    ARROWS LEFT  ${state.remaining}",color=Color.White)
   }
   Text(if(isRestoring)"Restoring your progress…" else state.message,color=Color(0xFFB8C8E0),style=MaterialTheme.typography.bodyMedium)
   Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Color(0xFF202C40)).padding(7.dp),verticalArrangement=Arrangement.spacedBy(3.dp)){
    for(y in 0 until board.height)Row(horizontalArrangement=Arrangement.spacedBy(3.dp)){for(x in 0 until board.width){
     val piece=board.pieces.indexOfFirst{it.alive&&it.cells.contains(Cell(x,y))}
     val arrow=if(piece>=0)board.pieces[piece]else null
     val active=board.activeCells.isEmpty()||Cell(x,y) in board.activeCells
     val target=if(!active)Color(0xFF101827)else if(arrow==null)Color(0xFF172235)else arrowColors[arrow.colorIndex%arrowColors.size]
     val color by animateColorAsState(target,animationSpec=spring(),label="path-cell")
     Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(color).clickable(enabled=!isRestoring&&!state.isSolved&&!state.isFailed){haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove);onEvent(ArrowUiEvent.TapCell(Cell(x,y)))},contentAlignment=Alignment.Center){
      if(arrow!=null){val isHead=arrow.cells.last()==Cell(x,y);Text(if(isHead)arrow.direction.glyph else "●",color=Color(0xFF132034),style=MaterialTheme.typography.titleLarge)}
     }
    }}
   }
   if(state.isSolved)Button(onClick={onEvent(ArrowUiEvent.Continue)},enabled=!isRestoring&&state.level<1000,modifier=Modifier.fillMaxWidth()){Text(if(state.level<1000)"Continue to Level ${state.level+1}" else "All 1,000 levels cleared")}
   Button(onClick={onEvent(ArrowUiEvent.Restart)},enabled=!isRestoring,modifier=Modifier.fillMaxWidth()){Text(if(state.isFailed)"Retry level" else "Restart puzzle")}
   TextButton(onClick={showImport=!showImport},enabled=!isRestoring){Text(if(showImport)"Close progress import" else "Import existing PWA progress")}
   if(showImport){
    Text("On the PWA, copy your save JSON from Settings and paste it here. Your browser save is not changed.",color=Color(0xFF9EB0CE),style=MaterialTheme.typography.bodySmall)
    OutlinedTextField(value=importText,onValueChange={importText=it},modifier=Modifier.fillMaxWidth(),minLines=3,maxLines=6,label={Text("Arrow Out save JSON")})
    Button(onClick={onImportSave(importText)},enabled=!isRestoring&&importText.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text("Import and restore progress")}
    if(importMessage.isNotBlank())Text(importMessage,color=Color(0xFF9EB0CE),style=MaterialTheme.typography.bodySmall)
   }
   if(privacyOptionsRequired)TextButton(onClick=onShowPrivacyOptions){Text("Privacy options",color=Color(0xFFB8C8E0))}
   if(state.isSolved)Text("Great job! +10 coins earned. You cleared every arrow.",color=Color(0xFF61DDA8))
   if(state.isFailed)Text("No hearts left. Retry to try this puzzle again.",color=Color(0xFFFF8A8A))
   Text("Only another arrow in the head's straight exit lane blocks a move.",color=Color(0xFF8294B3),style=MaterialTheme.typography.bodySmall)
  }
 }
}
@Preview(showBackground=true) @Composable private fun ArrowPreviewLight(){ArrowOutTheme(false){ArrowOutScreen(ArrowPuzzleEnginePreview.state,{})}}
@Preview(showBackground=true) @Composable private fun ArrowPreviewDark(){ArrowOutTheme(true){ArrowOutScreen(ArrowPuzzleEnginePreview.state,{})}}
private object ArrowPuzzleEnginePreview{val state=com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine().newGame()}
