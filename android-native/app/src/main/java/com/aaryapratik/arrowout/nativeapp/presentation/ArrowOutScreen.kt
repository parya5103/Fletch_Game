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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Density
import kotlinx.coroutines.delay
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.aaryapratik.arrowout.nativeapp.data.local.NativeSettings
import com.aaryapratik.arrowout.nativeapp.core.config.GameFeatureFlags
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import com.aaryapratik.arrowout.nativeapp.presentation.theme.ArrowOutTheme
import kotlin.math.floor
import kotlin.math.min


@Composable fun ArrowOutRoute(viewModel:ArrowOutViewModel=hiltViewModel(),privacyOptionsRequired:Boolean=false,onShowPrivacyOptions:()->Unit={}){
 val state by viewModel.uiState.collectAsStateWithLifecycle()
 val restoring by viewModel.isRestoring.collectAsStateWithLifecycle()
 val importMessage by viewModel.importMessage.collectAsStateWithLifecycle()
 val settings by viewModel.settings.collectAsStateWithLifecycle()
 var destination by rememberSaveable { mutableStateOf("home") }
 var selectedWorldId by rememberSaveable { mutableIntStateOf(1) }
 ArrowOutTheme(darkTheme=settings.darkTheme){
  val density = LocalDensity.current
  CompositionLocalProvider(LocalDensity provides Density(density.density, density.fontScale * if(settings.largeTextEnabled) 1.15f else 1f)) {
  when(destination){
   "home" -> ArrowOutHomeScreen(
    state=state,isRestoring=restoring,
    onContinue={if(state.isSolved)viewModel.onEvent(ArrowUiEvent.Continue);destination="game"},
    onWorlds={destination=if(GameFeatureFlags.worldMap)"worlds" else "game"},
    onDaily={viewModel.onEvent(ArrowUiEvent.DailyChallenge);destination="game"}
   )
   "worlds" -> ArrowOutWorldMapScreen(
    state=state,onBack={destination="home"},
    onWorldSelected={selectedWorldId=it;destination="levels"},
    onStorySeen={viewModel.onEvent(ArrowUiEvent.MarkStorySeen(it))}
   )
   "levels" -> {
    val world=ArrowOutWorldCatalog.byId(selectedWorldId)
    if(world==null) destination="worlds" else ArrowOutLevelSelectScreen(
     state=state,world=world,onBack={destination="worlds"},
     onLevelSelected={level->viewModel.onEvent(ArrowUiEvent.SelectLevel(level));destination="game"}
    )
   }
   else -> ArrowOutScreen(
    state,viewModel::onEvent,privacyOptionsRequired=privacyOptionsRequired,
    onShowPrivacyOptions=onShowPrivacyOptions,isRestoring=restoring,
    onImportSave=viewModel::importLegacy,importMessage=importMessage,
    settings=settings,onDarkThemeChange=viewModel::setDarkTheme,
    onHapticsChange=viewModel::setHapticsEnabled,
    onSoundEffectsChange=viewModel::setSoundEffectsEnabled,
    onColorblindPaletteChange=viewModel::setColorblindPaletteEnabled,
    onLargeTextChange=viewModel::setLargeTextEnabled,
    onNavigateHome={destination="home"},
    onNavigateWorlds={destination=if(GameFeatureFlags.worldMap)"worlds" else "home"}
   )
  }
  }
 }
}
@Composable fun ArrowOutScreen(
 state:ArrowGameState,
 onEvent:(ArrowUiEvent)->Unit,
 modifier:Modifier=Modifier,
 privacyOptionsRequired:Boolean=false,
 onShowPrivacyOptions:()->Unit={},
 isRestoring:Boolean=false,
 onImportSave:(String)->Unit={},
 importMessage:String="",
 settings:NativeSettings=NativeSettings(),
 onDarkThemeChange:(Boolean)->Unit={},
 onHapticsChange:(Boolean)->Unit={},
 onSoundEffectsChange:(Boolean)->Unit={},
 onColorblindPaletteChange:(Boolean)->Unit={},
 onLargeTextChange:(Boolean)->Unit={},
 onNavigateHome:()->Unit={},
 onNavigateWorlds:()->Unit={}
){
 val board=state.board
 val boardCellColor=MaterialTheme.colorScheme.surfaceVariant
 val boardGridColor=MaterialTheme.colorScheme.outlineVariant
 val activeArrowColors=(if(settings.colorblindPaletteEnabled)ArrowColorPalette.colorblindArgb else ArrowColorPalette.standardArgb).map{Color(it)}
 val haptics=LocalHapticFeedback.current
 val soundEffects=remember{NativeSoundEffects()}
 DisposableEffect(soundEffects){onDispose{soundEffects.release()}}
 var previousRemaining by remember(state.level){mutableIntStateOf(state.remaining)}
 var previousHearts by remember(state.level){mutableIntStateOf(state.hearts)}
 var previousHints by remember(state.level){mutableIntStateOf(state.hintsUsed)}
 LaunchedEffect(state.remaining,state.hearts,state.hintsUsed,state.isSolved,settings.soundEffectsEnabled){
  if(settings.soundEffectsEnabled){
   when{
    state.isSolved && previousRemaining>0->soundEffects.playWin()
    state.hearts<previousHearts->soundEffects.playBlocked()
    state.remaining<previousRemaining->soundEffects.playMove()
    state.hintsUsed>previousHints->soundEffects.playHint()
   }
  }
  previousRemaining=state.remaining;previousHearts=state.hearts;previousHints=state.hintsUsed
 }
 var showImport by remember{mutableStateOf(false)}
 var showSettings by remember{mutableStateOf(false)}
 var showIdleSolution by remember(state.level){mutableStateOf(false)}
 LaunchedEffect(state.level,state.remaining,state.undoStack.size,state.undosUsed,state.mistakes,state.hintsUsed,state.erasersUsed,isRestoring){
  showIdleSolution=false
  if(!isRestoring&&!state.isSolved&&!state.isFailed&&state.remaining>0){delay(14_000);showIdleSolution=true}
 }
 var importText by remember{mutableStateOf("")}
 var zoom by remember(state.level,board.width,board.height){mutableFloatStateOf(1f)}
 var pan by remember(state.level,board.width,board.height){mutableStateOf(Offset.Zero)}
 val transformState=rememberTransformableState{zoomChange,panChange,_->
  val next=(zoom*zoomChange).coerceIn(1f,4f)
  pan=if(next==1f)Offset.Zero else pan+panChange
  zoom=next
 }
 Scaffold(modifier=modifier.fillMaxSize(),containerColor=MaterialTheme.colorScheme.background){padding->
  Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(padding).padding(horizontal=18.dp),horizontalAlignment=Alignment.CenterHorizontally,verticalArrangement=Arrangement.spacedBy(12.dp)){
   Spacer(Modifier.height(8.dp))
   Text("ARROW OUT",style=MaterialTheme.typography.headlineLarge,color=MaterialTheme.colorScheme.onBackground)
   Text("A path puzzle",color=MaterialTheme.colorScheme.onSurfaceVariant)
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
    OutlinedButton(onClick=onNavigateHome,modifier=Modifier.weight(1f)){Text("Home")}
    OutlinedButton(onClick=onNavigateWorlds,modifier=Modifier.weight(1f)){Text("World map")}
   }
   OutlinedButton(onClick={showSettings=!showSettings},modifier=Modifier.fillMaxWidth()){Text(if(showSettings)"Close settings" else "Player settings")}
   if(showSettings){
    SettingsRow("Dark theme","Use the dark game palette",settings.darkTheme,onDarkThemeChange)
    SettingsRow("Haptic feedback","Vibrate on board taps",settings.hapticsEnabled,onHapticsChange)
    SettingsRow("Sound effects","Play optional puzzle feedback tones",settings.soundEffectsEnabled,onSoundEffectsChange)
    SettingsRow("Colorblind palette","Use a high-contrast, color-vision-friendly arrow palette",settings.colorblindPaletteEnabled,onColorblindPaletteChange)
    SettingsRow("Larger text","Increase in-game text size",settings.largeTextEnabled,onLargeTextChange)
   }
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
    Text(if(state.isDaily)"DAILY CHALLENGE" else "LEVEL ${state.level.toString().padStart(3,'0')}",color=MaterialTheme.colorScheme.onBackground)
    Text("♥ ${state.hearts}    ARROWS LEFT  ${state.remaining}",color=MaterialTheme.colorScheme.onBackground)
   }
   Text("COINS ${state.coins}   ·   BEST ${if(state.isDaily)state.dailyStars else state.bestStars[state.level]?:0} ★   ·   ERASERS ${state.erasersRemaining}   ·   STREAK ${state.dailyStreak}",color=Color(0xFFFFD166),style=MaterialTheme.typography.labelMedium)
   OutlinedButton(onClick={onEvent(ArrowUiEvent.DailyChallenge)},enabled=!isRestoring&&!state.isDaily,modifier=Modifier.fillMaxWidth()){Text("Daily Challenge · ${state.dailyStreak}-day streak")}
   Text("Unlocked campaign levels: ${state.unlockedLevel} / 1000",color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.labelSmall)
   if(state.isDaily)TextButton(onClick={onEvent(ArrowUiEvent.ExitDaily)},enabled=!isRestoring,modifier=Modifier.fillMaxWidth()){Text("Back to campaign")}
   Text(if(isRestoring)"Restoring your progress…" else if(state.eraserMode)"Tap an arrow to erase it" else state.message,color=if(state.eraserMode)Color(0xFFFFD166)else MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodyMedium)
   if(showIdleSolution&&state.solutionOrder.isEmpty()&&!state.isSolved&&!state.isFailed)Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.tertiaryContainer)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
     Text("Need a hand?",style=MaterialTheme.typography.titleMedium,color=MaterialTheme.colorScheme.onTertiaryContainer)
     Text("You have been on this puzzle for a while. Reveal a safe exit sequence without using a free hint.",color=MaterialTheme.colorScheme.onTertiaryContainer)
     Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
      TextButton(onClick={showIdleSolution=false}){Text("Not now")}
      Button(onClick={showIdleSolution=false;onEvent(ArrowUiEvent.ShowSolution)}){Text("Show solution")}
     }
    }
   }
   if(state.solutionOrder.isNotEmpty()) Card(Modifier.fillMaxWidth(),colors=CardDefaults.cardColors(containerColor=MaterialTheme.colorScheme.secondaryContainer)){
    Column(Modifier.padding(12.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
     Text("Solution guide",style=MaterialTheme.typography.titleMedium,color=MaterialTheme.colorScheme.onSecondaryContainer)
     Text("Tap the highlighted arrow next. ${state.solutionOrder.size} moves remain in this solution.",color=MaterialTheme.colorScheme.onSecondaryContainer)
     TextButton(onClick={onEvent(ArrowUiEvent.ClearSolution)}){Text("Hide solution")}
    }
   }
   Canvas(
    Modifier.fillMaxWidth().aspectRatio(board.width.toFloat()/board.height.toFloat())
      .clip(RoundedCornerShape(18.dp)).background(MaterialTheme.colorScheme.surface)
     .semantics { contentDescription = "Puzzle board. ${board.width} columns, ${board.height} rows, ${state.remaining} arrows remaining. Tap an arrow to move it." }
     .graphicsLayer{scaleX=zoom;scaleY=zoom;translationX=pan.x;translationY=pan.y}
     .transformable(transformState)
     .pointerInput(board,zoom,pan,isRestoring,state.isSolved,state.isFailed){
      detectTapGestures{point->
       if(!isRestoring&&!state.isSolved&&!state.isFailed){
        val localX=(point.x-pan.x)/zoom;val localY=(point.y-pan.y)/zoom
        val cell=Cell(floor(localX/(size.width/board.width)).toInt(),floor(localY/(size.height/board.height)).toInt())
        if(cell.x in 0 until board.width&&cell.y in 0 until board.height){if(settings.hapticsEnabled)haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove);onEvent(ArrowUiEvent.TapCell(cell))}
       }
      }
     }
   ){
    val cw=size.width/board.width;val ch=size.height/board.height;val unit=min(cw,ch)
    for(cell in board.activeCells){
     drawRect(boardCellColor,topLeft=Offset(cell.x*cw+1f,cell.y*ch+1f),size=androidx.compose.ui.geometry.Size(cw-2f,ch-2f))
    }
    for((pieceIndex,piece) in board.pieces.withIndex().filter{it.value.alive}){
     if(piece.cells.isEmpty())continue
     val color=if(pieceIndex==state.solutionOrder.firstOrNull()||pieceIndex==state.hintedPieceIndex)Color(0xFFFFD166)else activeArrowColors[piece.colorIndex%activeArrowColors.size]
     val points=piece.cells.map{Offset((it.x+0.5f)*cw,(it.y+0.5f)*ch)}
     val path=Path().apply{moveTo(points.first().x,points.first().y);points.drop(1).forEach{lineTo(it.x,it.y)}}
     drawPath(path,color,style=Stroke(width=unit*0.48f,cap=StrokeCap.Round,join=StrokeJoin.Round))
     val head=points.last();val dx=piece.direction.dx.toFloat();val dy=piece.direction.dy.toFloat();val px=-dy;val py=dx
     val tip=Offset(head.x+dx*unit*0.42f,head.y+dy*unit*0.42f)
     val base=Offset(head.x-dx*unit*0.26f,head.y-dy*unit*0.26f)
     val arrowHead=Path().apply{moveTo(tip.x,tip.y);lineTo(base.x+px*unit*0.31f,base.y+py*unit*0.31f);lineTo(base.x-px*unit*0.31f,base.y-py*unit*0.31f);close()}
     drawPath(arrowHead,Color.White)
    }
    for(x in 0..board.width)drawLine(boardGridColor,Offset(x*cw,0f),Offset(x*cw,size.height),1f)
    for(y in 0..board.height)drawLine(boardGridColor.copy(alpha=0.35f),Offset(0f,y*ch),Offset(size.width,y*ch),1f)
   }
   Text("Pinch to zoom · drag to explore larger boards",color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.labelSmall)
   if(state.isSolved)Button(onClick={onEvent(ArrowUiEvent.Continue)},enabled=!isRestoring&&(state.isDaily||state.level<1000),modifier=Modifier.fillMaxWidth()){Text(if(state.isDaily)"Return to campaign" else if(state.level<1000)"Continue to Level ${state.level+1}" else "All 1,000 levels cleared")}
   if(GameFeatureFlags.showSolution)OutlinedButton(onClick={showIdleSolution=false;onEvent(ArrowUiEvent.ShowSolution)},enabled=!isRestoring&&!state.isSolved&&!state.isFailed,modifier=Modifier.fillMaxWidth()){Text("Show solution")}
   Button(onClick={onEvent(ArrowUiEvent.Hint)},enabled=!isRestoring&&!state.isSolved&&!state.isFailed&&state.hintsUsed<ArrowPuzzleEngine.FREE_HINTS,modifier=Modifier.fillMaxWidth()){Text("Hint · ${ArrowPuzzleEngine.FREE_HINTS-state.hintsUsed} free left")}
   Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
    OutlinedButton(onClick={onEvent(ArrowUiEvent.Undo)},enabled=!isRestoring&&!state.isFailed&&state.undoStack.isNotEmpty(),modifier=Modifier.weight(1f)){Text("Undo")}
    OutlinedButton(onClick={onEvent(ArrowUiEvent.ToggleEraser)},enabled=!isRestoring&&!state.isSolved&&!state.isFailed&&(state.erasersRemaining>0||state.eraserMode),modifier=Modifier.weight(1f)){Text(if(state.eraserMode)"Cancel eraser" else "Eraser · ${state.erasersRemaining}")}
   }
   Button(onClick={onEvent(ArrowUiEvent.Restart)},enabled=!isRestoring,modifier=Modifier.fillMaxWidth()){Text(if(state.isFailed)"Retry level" else "Restart puzzle")}
   TextButton(onClick={showImport=!showImport},enabled=!isRestoring){Text(if(showImport)"Close progress import" else "Import existing PWA progress")}
   if(showImport){
    Text("On the PWA, open Settings → Export progress for Android, then paste the copied JSON here. Your browser save remains unchanged.",color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
    OutlinedTextField(value=importText,onValueChange={importText=it},modifier=Modifier.fillMaxWidth(),minLines=3,maxLines=6,label={Text("Arrow Out save JSON")})
    Button(onClick={onImportSave(importText)},enabled=!isRestoring&&importText.isNotBlank(),modifier=Modifier.fillMaxWidth()){Text("Import and restore progress")}
    if(importMessage.isNotBlank())Text(importMessage,color=Color(0xFF9EB0CE),style=MaterialTheme.typography.bodySmall)
   }
   if(privacyOptionsRequired)TextButton(onClick=onShowPrivacyOptions){Text("Privacy options",color=MaterialTheme.colorScheme.onSurfaceVariant)}
   if(state.isSolved)Text("Great job! +10 coins earned. You cleared every arrow.",color=Color(0xFF61DDA8))
   if(state.isFailed)Text("No hearts left. Retry to try this puzzle again.",color=Color(0xFFFF8A8A))
   Text("Only another arrow in the head's straight exit lane blocks a move.",color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
  }
 }
}
@Preview(showBackground=true) @Composable private fun ArrowPreviewLight(){ArrowOutTheme(false){ArrowOutScreen(ArrowPuzzleEnginePreview.state,{})}}
@Preview(showBackground=true) @Composable private fun ArrowPreviewDark(){ArrowOutTheme(true){ArrowOutScreen(ArrowPuzzleEnginePreview.state,{})}}
private object ArrowPuzzleEnginePreview{val state=com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine().newGame()}

@Composable
private fun SettingsRow(title:String,description:String,checked:Boolean,onCheckedChange:(Boolean)->Unit){
 Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween,verticalAlignment=Alignment.CenterVertically){
  Column(Modifier.weight(1f)){
   Text(title,color=MaterialTheme.colorScheme.onBackground,style=MaterialTheme.typography.bodyLarge)
   Text(description,color=MaterialTheme.colorScheme.onSurfaceVariant,style=MaterialTheme.typography.bodySmall)
  }
  Switch(checked=checked,onCheckedChange=onCheckedChange)
 }
}
