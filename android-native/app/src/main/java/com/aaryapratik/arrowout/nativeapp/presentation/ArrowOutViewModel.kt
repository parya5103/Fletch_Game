package com.aaryapratik.arrowout.nativeapp.presentation
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aaryapratik.arrowout.nativeapp.data.GameRepository
import com.aaryapratik.arrowout.nativeapp.di.IoDispatcher
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
@HiltViewModel class ArrowOutViewModel @Inject constructor(private val repository:GameRepository,@IoDispatcher private val io:CoroutineDispatcher):ViewModel(){
 private val engine=ArrowPuzzleEngine()
 private val _uiState=MutableStateFlow(engine.newGame())
 val uiState=_uiState.asStateFlow()
 private val _isRestoring=MutableStateFlow(true)
 val isRestoring=_isRestoring.asStateFlow()
 private val saveQueue=Channel<ArrowGameState>(Channel.CONFLATED)
 init{
  viewModelScope.launch(io){
   try{repository.load()?.let{_uiState.value=it}}
   catch(cancelled:CancellationException){throw cancelled}
   catch(error:Exception){_uiState.update{it.copy(message="Could not restore puzzle: ${error.message?: "unknown error"}")}}
   finally{_isRestoring.value=false}
  }
  viewModelScope.launch(io){
   for(snapshot in saveQueue){
    try{repository.save(snapshot)}
    catch(cancelled:CancellationException){throw cancelled}
    catch(error:Exception){_uiState.update{it.copy(message="Save failed: ${error.message?: "unknown error"}")}}
   }
  }
 }
 fun onEvent(event:ArrowUiEvent){
  if(_isRestoring.value)return
  when(event){
   is ArrowUiEvent.TapCell->_uiState.value=engine.tap(_uiState.value,event.cell);ArrowUiEvent.Restart->_uiState.value=engine.newGame()
  }
  saveQueue.trySend(_uiState.value)
 }
 override fun onCleared(){saveQueue.close();super.onCleared()}
}