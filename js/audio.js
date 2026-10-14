/**
 * Arrow Out! - Audio Module
 * Handles sound effects with Web Audio API
 */
'use strict';

const Audio = (function() {
  var ac = null;
  var enabled = true;

  function getCtx() {
    if (!enabled) return null;
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); } catch (e) { return null; }
    }
    return ac;
  }

  function tone(f0, f1, dur, type, vol, delay) {
    var c = getCtx();
    if (!c || c.state !== 'running') return;
    
    // Validate all numeric parameters are finite
    f0 = Number(f0);
    f1 = f1 !== undefined && f1 !== null ? Number(f1) : null;
    dur = Number(dur);
    vol = Number(vol);
    delay = Number(delay || 0);
    
    // Reject non-finite values
    if (!isFinite(f0) || !isFinite(dur) || !isFinite(vol) || !isFinite(delay)) return;
    if (f0 <= 0) return; // Frequency must be positive
    if (dur <= 0) return; // Duration must be positive
    if (vol <= 0) return; // Volume must be positive
    if (f1 !== null && !isFinite(f1) || f1 <= 0) return;
    
    var t0 = c.currentTime + delay;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function playSound(name) {
    if (!enabled) return;
    
    const sounds = {
      fly: function(dir) { 
        tone(520 + dir * 60, 180, 0.22, 'sine', 0.15); 
      },
      blocked: function() { 
        tone(160, 110, 0.14, 'square', 0.10); 
      },
      ui: function() { 
        tone(540, null, 0.05, 'sine', 0.08); 
      },
      undo: function() { 
        tone(240, 460, 0.14, 'triangle', 0.12); 
      },
      hint: function() { 
        tone(880, 1320, 0.16, 'sine', 0.10); 
      },
      win: function() {
        [523.25, 659.25, 783.99, 1046.5].forEach(function(f, i) { 
          tone(f, null, 0.30, 'sine', 0.14, i * 0.09); 
        });
      },
      success: function() {
        tone(880, 1320, 0.2, 'sine', 0.15);
        tone(1046.5, 1568, 0.3, 'sine', 0.12, 0.1);
      },
      error: function() {
        tone(200, 100, 0.2, 'sawtooth', 0.12);
      },
      star: function() {
        tone(1318.5, 1975.5, 0.15, 'sine', 0.12);
      }
    };
    
    if (sounds[name]) {
      sounds[name]();
    }
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) { 
      enabled = v; 
      if (!v && ac && ac.state === 'running') ac.suspend();
      else if (v && ac && ac.state === 'suspended') ac.resume();
    },
    unlock: function() { 
      var c = getCtx(); 
      if (c && c.state === 'suspended') c.resume(); 
    },
    suspend: function() { 
      if (ac && ac.state === 'running') ac.suspend(); 
    },
    resume: function() { 
      if (enabled && ac && ac.state === 'suspended') ac.resume(); 
    },
    play: playSound,
    fly: function(dir) { playSound('fly', dir); },
    blocked: function() { playSound('blocked'); },
    ui: function() { playSound('ui'); },
    undo: function() { playSound('undo'); },
    hint: function() { playSound('hint'); },
    win: function() { playSound('win'); },
    success: function() { playSound('success'); },
    error: function() { playSound('error'); },
    star: function() { playSound('star'); }
  };
})();
