/**
 * Arrow Out! - Audio Module
 * Handles sound effects with Web Audio API
 */
'use strict';

const Audio = (function() {
  var ac = null;
  var enabled = true;
  var musicOn = false;
  var musicTimer = 0;
  var musicStep = 0;
  // Soft ambient loop (A-minor-ish pad), synthesized - no audio files
  var MUSIC_LOOP = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 174.61];

  function getCtx() {
    if (!enabled) return null;
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ac = new AC(); } catch (e) { return null; }
    }
    return ac;
  }

  // Reusable numeric validation helpers (module boundary)
  var MIN_FREQ = 20, MAX_FREQ = 20000;
  function clampNum(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function toNum(v, dflt) { v = Number(v); return isFinite(v) ? v : dflt; }

  function tone(f0, f1, dur, type, vol, delay) {
    var c = getCtx();
    if (!c || c.state !== 'running') return;

    // Coerce and validate all numeric parameters before touching AudioParams
    f0 = toNum(f0, 0);
    f1 = (f1 === undefined || f1 === null) ? null : toNum(f1, 0);
    dur = toNum(dur, 0);
    vol = toNum(vol, 0);
    delay = toNum(delay || 0, 0);

    // Reject unusable values (NaN, Infinity, non-positive where required)
    if (!(f0 > 0) || !(dur > 0) || !(vol > 0) || delay < 0) return;
    if (f1 !== null && !(f1 > 0)) return;

    // Clamp into sensible, audible ranges so no AudioParam ever sees
    // a non-finite or out-of-range value
    f0 = clampNum(f0, MIN_FREQ, MAX_FREQ);
    if (f1 !== null) f1 = clampNum(f1, MIN_FREQ, MAX_FREQ);
    dur = clampNum(dur, 0.01, 10);
    vol = clampNum(vol, 0.0001, 1);
    delay = clampNum(delay, 0, 10);

    var t0 = c.currentTime + delay;
    if (!isFinite(t0) || t0 < 0) return;

    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    try {
      o.frequency.setValueAtTime(f0, t0);
      if (f1 !== null) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } catch (err) {
      // A single bad sound must never take down gameplay
      console.warn('Audio: skipped invalid tone', err && err.message);
      return;
    }
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function playSound(name) {
    if (!enabled) return;
    
    const sounds = {
      fly: function(dir, combo) {
        // Pitch rises one semitone per combo tap (capped) - the "juice" trend
        var step = Math.pow(1.0595, Math.min(Math.max(combo | 0, 0), 12));
        tone((520 + dir * 60) * step, 180 * step, 0.22, 'sine', 0.15);
        if (combo >= 3) tone(880 * step, null, 0.08, 'triangle', 0.05, 0.03);
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
      },
      back: function() {
        tone(400, 280, 0.09, 'sine', 0.07);
      }
    };
    
    if (sounds[name]) {
      // Forward any extra arguments (e.g. fly's direction) to the sound handler.
      // Without this, fly received dir===undefined -> 520 + undefined*60 = NaN.
      sounds[name].apply(null, Array.prototype.slice.call(arguments, 1));
    }
  }

  // --- Background music ---
  function musicTick() {
    if (!enabled || !musicOn) return;
    var f = MUSIC_LOOP[musicStep % MUSIC_LOOP.length];
    musicStep++;
    // Long soft sine pads at low volume; skip silently while the
    // AudioContext is suspended (before the first user gesture).
    tone(f, null, 2.4, 'sine', 0.028);
    if (musicStep % 4 === 1) tone(f * 1.5, null, 1.8, 'sine', 0.014, 0.45);
  }

  function startMusic() {
    if (musicOn) return;
    musicOn = true;
    musicStep = 0;
    musicTick();
    musicTimer = setInterval(musicTick, 2000);
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = 0; }
  }

  function isMusicOn() { return musicOn; }

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
    fly: function(dir, combo) {
      // Defensive default at the module boundary: dir must be a finite 0-3
      dir = Math.floor(Number(dir));
      if (!isFinite(dir) || dir < 0 || dir > 3) dir = 0;
      playSound('fly', dir, combo || 0);
    },
    blocked: function() { playSound('blocked'); },
    ui: function() { playSound('ui'); },
    undo: function() { playSound('undo'); },
    hint: function() { playSound('hint'); },
    win: function() { playSound('win'); },
    success: function() { playSound('success'); },
    error: function() { playSound('error'); },
    back: function() { playSound('back'); },
    star: function() { playSound('star'); },
    startMusic: startMusic,
    stopMusic: stopMusic,
    isMusicOn: isMusicOn
  };
})();



