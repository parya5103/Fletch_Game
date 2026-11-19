package com.aaryapratik.arrowout.nativeapp
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import dagger.hilt.android.AndroidEntryPoint
import com.aaryapratik.arrowout.nativeapp.presentation.ArrowOutRoute
@AndroidEntryPoint class MainActivity:ComponentActivity(){
 private lateinit var adsConsentManager:AdsConsentManager
 override fun onCreate(savedInstanceState:Bundle?){
  super.onCreate(savedInstanceState)
  adsConsentManager=AdsConsentManager(this)
  adsConsentManager.start()
  setContent{ArrowOutRoute(privacyOptionsRequired=adsConsentManager.privacyOptionsRequired,onShowPrivacyOptions=adsConsentManager::showPrivacyOptions)}
 }
}