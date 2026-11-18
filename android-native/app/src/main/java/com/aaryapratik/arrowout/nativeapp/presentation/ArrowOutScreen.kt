package com.aaryapratik.arrowout.nativeapp.presentation
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.drawLine
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import com.aaryapratik.arrowout.nativeapp.presentation.theme.ArrowOutTheme
import kotlin.math.floor
import kotlin.math.min

private val arrowColors=listOf(Color(0xFF48C6EF),Color(0xFFFFB454),Color(0xFF9D85FF),Color(0xFF4DD6A1),Color(0xFFFF718F),Color(0xFFFFD166),Color(0xFF80ED99),Color(0xFFFF8FAB))
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
 var levelInput by remember(state.level){mutableStateOf(state.level.toString())}
 var zoom by remember(state.level,board.width,board.height){mutableFloatStateOf(1f)}
 var pan by remember(state.level,board.width,board.height){mutableStateOf(Offset.Zero)}
 val transformState=rememberTransformableState{zoomChange,panChange,_->
  val next=(zoom*zoomChange).coerceIn(1f,4f)
  pan=if(next==1f)Offset.Zero else pan+panChange
  zoom=next
 }
 Scaffold(modifier=modifier.fillMaxSize(),containerColor=Color(0xFF101827)){padding->
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(horizontal=18.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)){
   Spacer(Modifier.height(8.dp))
   Text("ARROW OUT",style=MaterialTheme.typography.headlineLarge,color=Color.White)
   Text("A path puzzle",color=Color(0xFF9EB0CE))
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
    Text(if(state.isDaily)"DAILY CHALLENGE" else "LEVEL ${state.level.toString().padStart(3,'0')}",color=Color.White)
    Text("♥ ${state.hearts}    ARROWS LEFT  ${state.remaining}",color=Color.White)
   }
   Text("COINS ${state.coins}   ·   BEST ${if(state.isDaily)state.dailyStars else state.bestStars[state.level]?:0} ★   ·   ERASERS ${state.erasersRemaining}   ·   STREAK ${state.dailyStreak}",color=Color(0xFFFFD166),style=MaterialTheme.typography.labelMedium)
   OutlinedButton(onClick={onEvent(ArrowUiEvent.DailyChallenge)},enabled=!isRestoring&&!state.isDaily,modifier=Modifier.fillMaxWidth()){Text("Daily Challenge · ${state.dailyStreak}-day streak")}
   Text("Unlocked campaign levels: ${state.unlockedLevel} / 1000",color=Color(0xFF9EB0CE),style=MaterialTheme.typography.labelSmall)
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp),verticalAlignment=Alignment.CenterVertically){
    OutlinedTextField(value=levelInput,onValueChange={levelInput=it.filter(Char::isDigit).take(4)},modifier=Modifier.weight(1f),singleLine=true,label={Text("Open level")},keyboardOptions=KeyboardOptions(keyboardType=KeyboardType.Number))
    val selectedLevel=levelInput.toIntOrNull()
    Button(onClick={selectedLevel?.let{onEvent(ArrowUiEvent.SelectLevel(it))}},enabled=!isRestoring&&!state.isDaily&&selectedLevel!=null&&selectedLevel in 1..state.unlockedLevel){Text("Play")}
   }
   if(state.isDaily)TextButton(onClick={onEvent(ArrowUiEvent.ExitDaily)},enabled=!isRestoring,modifier=Modifier.fillMaxWidth()){Text("Back to campaign")}
   Text(if(isRestoring)"Restoring your progress…" else if(state.eraserMode)"Tap an arrow to erase it" else state.message,color=if(state.eraserMode)Color(0xFFFFD166)else Color(0xFFB8C8E0),style=MaterialTheme.typography.bodyMedium)
   Canvas(
    Modifier.fillMaxWidth().aspectRatio(board.width.toFloat()/board.height.toFloat())
     .clip(RoundedCornerShape(18.dp)).background(Color(0xFF202C40))
     .graphicsLayer{scaleX=zoom;scaleY=zoom;translationX=pan.x;translationY=pan.y}
     .transformable(transformState)
     .pointerInput(board,zoom,pan,isRestoring,state.isSolved,state.isFailed){
      detectTapGestures{point->
       if(!isRestoring&&!state.isSolved&&!state.isFailed){
        val localX=(point.x-pan.x)/zoom;val localY=(point.y-pan.y)/zoom
        val cell=Cell(floor(localX/(size.width/board.width)).toInt(),floor(localY/(size.height/board.height)).toInt())
        if(cell.x in 0 until board.width&&cell.y in 0 until board.height){haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove);onEvent(ArrowUiEvent.TapCell(cell))}
       }
      }
     }
   ){
    val cw=size.width/board.width;val ch=size.height/board.height;val unit=min(cw,ch)
    for(cell in board.activeCells){
     drawRect(Color(0xFF263751),topLeft=Offset(cell.x*cw+1f,cell.y*ch+1f),size=androidx.compose.ui.geometry.Size(cw-2f,ch-2f))
    }
    for((pieceIndex,piece) in board.pieces.withIndex().filter{it.value.alive}){
     if(piece.cells.isEmpty())continue
     val color=if(pieceIndex==state.hintedPieceIndex)Color(0xFFFFD166)else arrowColors[piece.colorIndex%arrowColors.size]
     val points=piece.cells.map{Offset((it.x+0.5f)*cw,(it.y+0.5f)*ch)}
     val path=Path().apply{moveTo(points.first().x,points.first().y);points.drop(1).forEach{lineTo(it.x,it.y)}}
     drawPath(path,color,style=Stroke(width=unit*0.48f,cap=StrokeCap.Round,join=StrokeJoin.Round))
     val head=points.last();val dx=piece.direction.dx.toFloat();val dy=piece.direction.dy.toFloat();val px=-dy;val py=dx
     val tip=Offset(head.x+dx*unit*0.42f,head.y+dy*unit*0.42f)
     val base=Offset(head.x-dx*unit*0.26f,head.y-dy*unit*0.26f)
     val arrowHead=Path().apply{moveTo(tip.x,tip.y);lineTo(base.x+px*unit*0.31f,base.y+py*unit*0.31f);lineTo(base.x-px*unit*0.31f,base.y-py*unit*0.31f);close()}
     drawPath(arrowHead,Color.White)
    }
    for(x in 0..board.width)drawLine(Color(0x222A3D59),Offset(x*cw,0f),Offset(x*cw,size.height),1f)
    for(y in 0..board.height)drawLine(Color(0x222A3D59),Offset(0f,y*ch),Offset(size.width,y*ch),1f)
   }
   Text("Pinch to zoom · drag to explore larger boards",color=Color(0xFF8294B3),style=MaterialTheme.typography.labelSmall)
   if(state.isSolved)Button(onClick={onEvent(ArrowUiEvent.Continue)},enabled=!isRestoring&&(state.isDaily||state.level<1000),modifier=Modifier.fillMaxWidth()){Text(if(state.isDaily)"Return to campaign" else if(state.level<1000)"Continue to Level ${state.level+1}" else "All 1,000 levels cleared")}
   Button(onClick={onEvent(ArrowUiEvent.Hint)},enabled=!isRestoring&&!state.isSolved&&!state.isFailed&&state.hintsUsed<ArrowPuzzleEngine.FREE_HINTS,modifier=Modifier.fillMaxWidth()){Text("Hint · ${ArrowPuzzleEngine.FREE_HINTS-state.hintsUsed} free left")}
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
    OutlinedButton(onClick={onEvent(ArrowUiEvent.Undo)},enabled=!isRestoring&&!state.isFailed&&state.undoStack.isNotEmpty(),modifier=Modifier.weight(1f)){Text("Undo")}
    OutlinedButton(onClick={onEvent(ArrowUiEvent.ToggleEraser)},enabled=!isRestoring&&!state.isSolved&&!state.isFailed&&(state.erasersRemaining>0||state.eraserMode),modifier=Modifier.weight(1f)){Text(if(state.eraserMode)"Cancel eraser" else "Eraser · ${state.erasersRemaining}")}
   }
   Button(onClick={onEvent(ArrowUiEvent.Restart)},enabled=!isRestoring,modifier=Modifier.fillMaxWidth()){Text(if(state.isFailed)"Retry level" else "Restart puzzle")}
   TextButton(onClick={showImport=!showImport},enabled=!isRestoring){Text(if(showImport)"Close progress import" else "Import existing PWA progress")}
   if(showImport){
    Text("On the PWA, open Settings → Export progress for Android, then paste the copied JSON here. Your browser save remains unchanged.",color=Color(0xFF9EB0CE),style=MaterialTheme.typography.bodySmall)
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
