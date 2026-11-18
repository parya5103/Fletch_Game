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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
@HiltViewModel class ArrowOutViewModel @Inject constructor(private val repository:GameRepository,@IoDispatcher private val io:CoroutineDispatcher):ViewModel(){
 private val engine=ArrowPuzzleEngine();private val _uiState=MutableStateFlow(engine.newGame());val uiState=_uiState.asStateFlow()
 fun onEvent(event:ArrowUiEvent){when(event){is ArrowUiEvent.TapCell->_uiState.value=engine.tap(_uiState.value,event.cell);ArrowUiEvent.Restart->_uiState.value=engine.newGame()};viewModelScope.launch(io){try{repository.save(1,_uiState.value.remaining)}catch(cancelled:CancellationException){throw cancelled}catch(error:Exception){_uiState.value=_uiState.value.copy(message="Save failed: ${error.message?: "unknown error"}")}}}
}