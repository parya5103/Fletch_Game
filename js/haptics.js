/**
 * Arrow Out! - Haptics Module
 * Handles vibration feedback for supported devices
 */
'use strict';

const Haptics = (function() {
  var enabled = true;
  var supported = false;

  // Check for vibration support
  function checkSupport() {
    supported = 'vibrate' in navigator;
    return supported;
  }

  // Vibrate with pattern
  function vibrate(pattern, duration) {
    if (!enabled || !supported) return;
    
    try {
      if (Array.isArray(pattern)) {
        navigator.vibrate(pattern);
      } else if (typeof pattern === 'number') {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Vibration API might be restricted
      console.log('Vibration not available:', e);
    }
  }

  // Light tap feedback
  function lightTap() {
    vibrate(10); // 10ms vibration
  }

  // Medium tap feedback
  function mediumTap() {
    vibrate(20); // 20ms vibration
  }

  // Heavy tap feedback (for blocked moves)
  function heavyTap() {
    vibrate([20, 10, 20]); // Pattern: vibrate, pause, vibrate
  }

  // Success feedback
  function success() {
    vibrate([10, 20, 10]); // Short pattern for success
  }

  // Error feedback
  function error() {
    vibrate([40, 20, 40]); // Longer pattern for errors
  }

  // Hint feedback
  function hint() {
    vibrate([10, 10, 10, 10]); // Pulse pattern
  }

  // Win feedback
  function win() {
    vibrate([10, 20, 10, 20, 10]); // Celebration pattern
  }

  // Set enabled state
  function setEnabled(v) {
    enabled = v;
  }

  // Get enabled state
  function getEnabled() {
    return enabled;
  }

  // Check if haptics are supported
  function isSupported() {
    return supported;
  }

  // Initialize
  checkSupport();

  return {
    enabled: enabled,
    supported: supported,
    setEnabled: setEnabled,
    getEnabled: getEnabled,
    isSupported: isSupported,
    lightTap: lightTap,
    mediumTap: mediumTap,
    heavyTap: heavyTap,
    success: success,
    error: error,
    hint: hint,
    win: win
  };
})();
