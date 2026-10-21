/**
 * Arrow Out! - World Story & Guardian Module (v4.2)
 * Eight themed worlds (125 levels each), original copyright-safe
 * guardian portraits (inline SVG only - no external assets/CDN), and a
 * three-act typewriter cutscene. Presentation module: the ONLY save
 * writes are one-time storySeen markers. Story failure never blocks
 * gameplay - every entry point is try/catch guarded.
 */
'use strict';

const ArrowOutStory = (function () {
  // ---- The eight worlds (levels 1-1000, 125 per world) ----
  const WORLDS = [
    { id: 'w1', start: 1, end: 125, title: 'Whisperwind Meadow', guardian: 'Lyra', epithet: 'the Songkeeper', biome: 'butterflies',
      palette: { sky: '#064e3b', road: '#34d399', accent: '#059669', glow: '#a7f3d0' },
      story: [
        'A wrong wind scattered every arrow of the meadow, and the songs that kept the paths open fell silent. Lyra, the Songkeeper, hid the last true note inside a fletching made of leaf and light.',
        'She asks you to walk the winding green and free each arrow in the old order \u2014 the one the wind undid. Every path you clear returns one note to the meadow\u2019s quiet song.',
        'When the last arrow flies, Lyra lifts her head and sings the meadow awake. \u201CThe song remembers you, fletcher,\u201D she says. \u201CCarry it east.\u201D'
      ] },
    { id: 'w2', start: 126, end: 250, title: 'Tidecaller Coast', guardian: 'Orin', epithet: 'of the Living Tide', biome: 'tide',
      palette: { sky: '#083344', road: '#22d3ee', accent: '#0891b2', glow: '#cffafe' },
      story: [
        'The tide at Orin\u2019s coast stops mid-wave, frozen by a storm that lost its way inland. Orin, keeper of the living tide, cannot sing the water forward while arrows clog the old channels.',
        'He lends you his patience: move only what the water would allow, one clean path at a time. The tide marks each arrow you free with a ring of light.',
        'The wave Orin held finally falls, and the coast breathes again. \u201CThe tide now knows your hands,\u201D Orin says. \u201CKaelen waits where the sea meets trees.\u201D'
      ] },
    { id: 'w3', start: 251, end: 375, title: 'Stormveil Woods', guardian: 'Kaelen', epithet: 'the Verdant Warden', biome: 'leaves',
      palette: { sky: '#14532d', road: '#4ade80', accent: '#15803d', glow: '#bbf7d0' },
      story: [
        'Lightning struck the heart of Stormveil and never left \u2014 it loops the same crooked trail through the branches. Kaelen guards a wood where every tree grew around an arrow overnight.',
        'Kaelen gives you a simple rule: the forest frees only what stands in nothing\u2019s way. Find the order the lightning wrote, and unwind it.',
        'The looping storm follows its arrows out of the wood and fades over the sea. \u201CRoots remember,\u201D Kaelen says. \u201CGo up \u2014 Selene keeps the night.\u201D'
      ] },
    { id: 'w4', start: 376, end: 500, title: 'Moonlit Ruins', guardian: 'Selene', epithet: 'the Moonwarden', biome: 'moonfire',
      palette: { sky: '#1e1b4b', road: '#818cf8', accent: '#6366f1', glow: '#e0e7ff' },
      story: [
        'The moon over Selene\u2019s ruins did not set, and the stones that drank its light grew restless. Selene sealed the ruins with moonlight so nothing wakes before its time.',
        'Only careful hands may open her seal: arrows in the right order, no wrong pull, no rushed heart. Each cleared path dims one restless stone.',
        'The ruins settle into honest shadow, and the moon finally moves. \u201CYou unbind gently,\u201D Selene says. \u201CThe sky fleet could use a fletcher.\u201D'
      ] },
    { id: 'w5', start: 501, end: 625, title: 'Zephyr Skies', guardian: 'Captain Zephyr', epithet: 'of the Cloudward Fleet', biome: 'wind',
      palette: { sky: '#0c4a6e', road: '#38bdf8', accent: '#0284c7', glow: '#bae6fd' },
      story: [
        'Captain Zephyr\u2019s cloud fleet ran aground on a wind that refuses to blow. Arrows dropped from an old battle now pin each vessel\u2019s rope to the sky itself.',
        'The captain does not ask for bravery \u2014 only order. Cut the fleet loose arrow by arrow, the way a sailor reads a knot: from the outside in.',
        'With a snap of canvas the fleet rides the first honest wind in years. \u201CFine hands, fletcher!\u201D Zephyr laughs. \u201CValkor\u2019s mountains sit heavy on the horizon.\u201D'
      ] },
    { id: 'w6', start: 626, end: 750, title: 'Emberforge Peaks', guardian: 'Valkor', epithet: 'the Forgemaster', biome: 'embers',
      palette: { sky: '#450a0a', road: '#fb923c', accent: '#ea580c', glow: '#fed7aa' },
      story: [
        'Valkor\u2019s forge cooled the night a thousand arrows jammed its chimneys, and the peaks above have been snowing ash ever since. The Forgemaster will not relight a forge he cannot clear.',
        'He sets one rule in smoke and ember: free the paths that choke the vents, hottest first, and the forge will remember its fire.',
        'The forge breathes orange again, and the ash turns back to clean snow. \u201CForged in order, cleared in order,\u201D Valkor rumbles. \u201CThalor has been waiting at the eclipse.\u201D'
      ] },
    { id: 'w7', start: 751, end: 875, title: 'Eclipse Sanctum', guardian: 'Archmage Thalor', epithet: 'of the Half-Light', biome: 'eclipse',
      palette: { sky: '#2e1065', road: '#a78bfa', accent: '#7c3aed', glow: '#ddd6fe' },
      story: [
        'An eclipse over Thalor\u2019s sanctum stuck halfway, and the light it trapped now binds every arch in the halls. The Archmage has kept his silence through a hundred years of half-day.',
        'Thalor\u2019s terms are exact: unbind each arch by the order of its making. Break the sequence, and the trapped light will simply wait for you to begin again.',
        'The eclipse slides shut and open like an eye, and dawn arrives a century late. \u201CPrecisely done,\u201D Thalor says. \u201CAstraea has watched you from the first arrow.\u201D'
      ] },
    { id: 'w8', start: 876, end: 1000, title: 'Starfall Court', guardian: 'Queen Astraea', epithet: 'of the Falling Stars', biome: 'starfall',
      palette: { sky: '#451a03', road: '#fbbf24', accent: '#d97706', glow: '#fde68a' },
      story: [
        'Queen Astraea\u2019s court of falling stars stalled mid-descent when its constellations tangled into knots of light. She has waited a thousand levels of dark for a fletcher with patient hands.',
        'Her final ask is the oldest one: free every arrow in order, and let the stars fall true. The court counts each clear path as one star coming home.',
        'The sky fills with falling light, and the court lands softly for the first time in an age. \u201CThe arrows are out,\u201D Queen Astraea says. \u201CThe story is yours now, fletcher.\u201D'
      ] }
  ];

  function worldForLevel(n) {
    n = Math.floor(Number(n)) || 0;
    for (var i = 0; i < WORLDS.length; i++) {
      if (n >= WORLDS[i].start && n <= WORLDS[i].end) return WORLDS[i];
    }
    return WORLDS[n >= 1000 ? 7 : 0];
  }

  // ---- Original guardian portraits (inline SVG, no external assets) ----
  const PORTRAITS = {
    w1: '<svg viewBox="0 0 120 120" role="img" aria-label="Lyra, the Songkeeper"><circle cx="60" cy="60" r="58" fill="#064e3b"/><path d="M20 120 Q24 86 60 84 Q96 86 100 120 Z" fill="#10b981"/><path d="M60 18 Q30 34 30 62 Q30 84 60 88 Q90 84 90 62 Q90 34 60 18 Z" fill="#34d399"/><circle cx="60" cy="58" r="16" fill="#065f46"/><circle cx="54" cy="56" r="2.6" fill="#ecfdf5"/><circle cx="66" cy="56" r="2.6" fill="#ecfdf5"/><path d="M44 74 Q60 82 76 74" stroke="#065f46" stroke-width="2.4" fill="none"/><path d="M38 40 q-8 4 -10 12 q8 -2 12 -8 Z" fill="#fde68a"/><path d="M82 40 q8 4 10 12 q-8 -2 -12 -8 Z" fill="#fde68a"/><path d="M60 30 q4 -8 12 -9 q-4 6 -9 8 Z" fill="#fbbf24"/></svg>',
    w2: '<svg viewBox="0 0 120 120" role="img" aria-label="Orin, of the Living Tide"><circle cx="60" cy="60" r="58" fill="#083344"/><path d="M14 96 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 14 0 L108 120 L12 120 Z" fill="#155e75"/><path d="M20 120 Q26 84 60 82 Q94 84 100 120 Z" fill="#0e7490"/><path d="M60 20 Q34 36 34 62 Q34 82 60 86 Q86 82 86 62 Q86 36 60 20 Z" fill="#22d3ee"/><circle cx="60" cy="56" r="15" fill="#164e63"/><circle cx="54" cy="54" r="2.6" fill="#ecfeff"/><circle cx="66" cy="54" r="2.6" fill="#ecfeff"/><path d="M55 66 L60 74 L65 66 Z" fill="#164e63"/><path d="M46 42 q6 -10 14 -11 q-6 6 -12 10 Z" fill="#67e8f9"/><path d="M40 92 q10 4 20 0" stroke="#a5f3fc" stroke-width="2.4" fill="none"/></svg>',
    w3: '<svg viewBox="0 0 120 120" role="img" aria-label="Kaelen, the Verdant Warden"><circle cx="60" cy="60" r="58" fill="#14532d"/><path d="M20 120 Q26 86 60 84 Q94 86 100 120 Z" fill="#166534"/><path d="M60 24 Q36 38 36 62 Q36 82 60 86 Q84 82 84 62 Q84 38 60 24 Z" fill="#22c55e"/><path d="M42 30 q-10 -8 -12 -20 q12 4 16 14 Z" fill="#15803d"/><path d="M78 30 q10 -8 12 -20 q-12 4 -16 14 Z" fill="#15803d"/><path d="M34 16 q-2 -6 -8 -8 q6 -2 10 2 Z" fill="#166534"/><path d="M86 16 q2 -6 8 -8 q-6 -2 -10 2 Z" fill="#166534"/><circle cx="60" cy="56" r="15" fill="#052e16"/><circle cx="54" cy="54" r="2.6" fill="#f0fdf4"/><circle cx="66" cy="54" r="2.6" fill="#f0fdf4"/><path d="M52 68 Q60 74 68 68" stroke="#052e16" stroke-width="2.4" fill="none"/><path d="M50 78 l-4 10 M70 78 l4 10" stroke="#166534" stroke-width="2.4"/></svg>',
    w4: '<svg viewBox="0 0 120 120" role="img" aria-label="Selene, the Moonwarden"><circle cx="60" cy="60" r="58" fill="#1e1b4b"/><circle cx="60" cy="30" r="46" fill="#312e81"/><path d="M20 120 Q26 88 60 86 Q94 88 100 120 Z" fill="#4338ca"/><path d="M60 22 Q36 38 36 62 Q36 84 60 88 Q84 84 84 62 Q84 38 60 22 Z" fill="#a5b4fc"/><circle cx="60" cy="56" r="15" fill="#312e81"/><circle cx="54" cy="54" r="2.6" fill="#eef2ff"/><circle cx="66" cy="54" r="2.6" fill="#eef2ff"/><path d="M78 26 a10 10 0 1 0 8 16 a12 12 0 1 1 -8 -16 Z" fill="#e0e7ff"/><circle cx="34" cy="40" r="1.8" fill="#c7d2fe"/><circle cx="90" cy="44" r="1.8" fill="#c7d2fe"/><circle cx="40" cy="22" r="1.4" fill="#c7d2fe"/></svg>',
    w5: '<svg viewBox="0 0 120 120" role="img" aria-label="Captain Zephyr of the Cloudward Fleet"><circle cx="60" cy="60" r="58" fill="#0c4a6e"/><path d="M18 78 q14 -12 30 -4 q10 -12 28 -6 q16 -8 28 4 q8 10 -4 16 L22 90 q-10 -4 -4 -12 Z" fill="#e0f2fe"/><path d="M20 120 Q26 86 60 84 Q94 86 100 120 Z" fill="#075985"/><path d="M60 22 Q38 34 38 54 L82 54 Q82 34 60 22 Z" fill="#0284c7"/><path d="M38 54 L82 54 Q80 66 60 68 Q40 66 38 54 Z" fill="#0369a1"/><circle cx="50" cy="52" r="9" fill="#bae6fd"/><circle cx="70" cy="52" r="9" fill="#bae6fd"/><path d="M38 52 L30 54 L38 56 M82 52 L90 54 L82 56" stroke="#0369a1" stroke-width="3" fill="none"/><circle cx="60" cy="78" r="6" fill="#0c4a6e"/><path d="M46 96 h28" stroke="#e0f2fe" stroke-width="3"/></svg>',
    w6: '<svg viewBox="0 0 120 120" role="img" aria-label="Valkor, the Forgemaster"><circle cx="60" cy="60" r="58" fill="#450a0a"/><path d="M20 120 Q26 86 60 84 Q94 86 100 120 Z" fill="#991b1b"/><path d="M60 24 Q38 36 38 60 Q38 82 60 86 Q82 82 82 60 Q82 36 60 24 Z" fill="#ea580c"/><path d="M40 34 q-12 -6 -16 -18 q14 2 20 12 Z" fill="#7c2d12"/><path d="M80 34 q12 -6 16 -18 q-14 2 -20 12 Z" fill="#7c2d12"/><circle cx="60" cy="56" r="15" fill="#450a0a"/><circle cx="54" cy="54" r="2.6" fill="#fed7aa"/><circle cx="66" cy="54" r="2.6" fill="#fed7aa"/><path d="M48 70 Q60 78 72 70" stroke="#450a0a" stroke-width="3" fill="none"/><path d="M84 96 l8 -10 l6 4 l-8 10 Z" fill="#fbbf24"/><path d="M82 98 l14 -8" stroke="#7c2d12" stroke-width="4"/><circle cx="34" cy="30" r="2" fill="#fb923c"/><circle cx="90" cy="24" r="2" fill="#fb923c"/><circle cx="28" cy="44" r="1.6" fill="#fdba74"/></svg>',
    w7: '<svg viewBox="0 0 120 120" role="img" aria-label="Archmage Thalor of the Half-Light"><circle cx="60" cy="60" r="58" fill="#2e1065"/><circle cx="60" cy="60" r="34" fill="none" stroke="#c4b5fd" stroke-width="3"/><circle cx="70" cy="52" r="30" fill="#2e1065"/><circle cx="70" cy="52" r="26" fill="#ddd6fe"/><path d="M20 120 Q28 86 60 84 Q92 86 100 120 Z" fill="#5b21b6"/><path d="M60 14 Q34 34 34 62 Q34 84 60 88 Q86 84 86 62 Q86 34 60 14 Z" fill="#7c3aed"/><circle cx="60" cy="56" r="15" fill="#2e1065"/><circle cx="54" cy="54" r="2.6" fill="#f5f3ff"/><circle cx="66" cy="54" r="2.6" fill="#f5f3ff"/><path d="M30 90 l-8 18 M90 90 l8 18" stroke="#a78bfa" stroke-width="3"/><circle cx="22" cy="112" r="3" fill="#c4b5fd"/><circle cx="98" cy="112" r="3" fill="#c4b5fd"/></svg>',
    w8: '<svg viewBox="0 0 120 120" role="img" aria-label="Queen Astraea of the Falling Stars"><circle cx="60" cy="60" r="58" fill="#451a03"/><circle cx="60" cy="60" r="48" fill="#78350f"/><path d="M20 120 Q26 88 60 86 Q94 88 100 120 Z" fill="#92400e"/><path d="M60 24 Q38 36 38 60 Q38 84 60 88 Q82 84 82 60 Q82 36 60 24 Z" fill="#f59e0b"/><circle cx="60" cy="58" r="16" fill="#78350f"/><circle cx="54" cy="56" r="2.6" fill="#fffbeb"/><circle cx="66" cy="56" r="2.6" fill="#fffbeb"/><path d="M38 28 l4 -14 l6 10 l12 -16 l4 16 l10 -8 l-2 14 Z" fill="#fde68a"/><path d="M70 24 l6 -6 l0 10 Z" fill="#fde68a"/><circle cx="30" cy="52" r="1.8" fill="#fde68a"/><circle cx="92" cy="44" r="1.8" fill="#fde68a"/><circle cx="24" cy="80" r="1.6" fill="#fbbf24"/><circle cx="96" cy="76" r="1.6" fill="#fbbf24"/></svg>'
  };

  function portraitFor(worldId) {
    return PORTRAITS[worldId] || PORTRAITS.w1;
  }

  // ---- Star economy helpers (read-only against the save) ----
  function worldStars(save, world) {
    var total = 0;
    if (!save || !save.best) return 0;
    for (var l = world.start; l <= world.end; l++) {
      var b = save.best[l];
      if (b && b.stars) total += b.stars;
    }
    return total;
  }

  // Royal Star Chest: unlocks at 15 stars earned inside the world;
  // free one-time claim, no deduction (approved design).
  function starChestReady(save, world) {
    if (!save) return false;
    var claimed = save.starChestClaimed && save.starChestClaimed[world.id] === true;
    return !claimed && worldStars(save, world) >= 15;
  }

  // ---- Cutscene one-time markers (the only save writes here) ----
  function hasSeen(save, worldId) {
    return !!(save && save.storySeen && save.storySeen[worldId] === true);
  }

  function markSeen(worldId) {
    var save = Storage.getSave();
    if (!save) return;
    if (!save.storySeen || typeof save.storySeen !== 'object') save.storySeen = {};
    if (save.storySeen[worldId] === true) return; // idempotent
    save.storySeen[worldId] = true;
    Storage.updateSave({ storySeen: save.storySeen });
  }

  // First reached-but-unseen world, for the map-open trigger.
  function pendingWorld(save) {
    if (!save) return null;
    for (var i = 0; i < WORLDS.length; i++) {
      var w = WORLDS[i];
      if (save.unlocked >= w.start && !hasSeen(save, w.id)) return w;
    }
    return null;
  }

  // ---- Three-act typewriter cutscene ----
  var activeWorld = null, actIdx = 0, typeTimer = 0, typedFull = true;

  function reducedMotion() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) {}
    try {
      var s = Storage.getSave();
      return !!(s && s.settings && s.settings.reducedMotion);
    } catch (e) { return false; }
  }

  function isShown() {
    var dlg = document.getElementById('dlg-story');
    return !!(dlg && dlg.classList && dlg.classList.contains('show'));
  }

  function stopTyping() {
    if (typeTimer) { clearInterval(typeTimer); typeTimer = 0; }
  }

  function renderAct() {
    var txt = activeWorld.story[actIdx];
    var el = document.getElementById('story-act-text');
    var num = document.getElementById('story-act-num');
    var title = document.getElementById('story-world-title');
    var who = document.getElementById('story-guardian-name');
    var art = document.getElementById('story-portrait');
    if (num) num.textContent = 'Act ' + (actIdx + 1) + ' of 3';
    if (title) title.textContent = 'World ' + (WORLDS.indexOf(activeWorld) + 1) + ' \u00b7 ' + activeWorld.title;
    if (who) who.textContent = activeWorld.guardian + ', ' + activeWorld.epithet;
    if (art) art.innerHTML = portraitFor(activeWorld.id);
    if (!el) return;
    stopTyping();
    if (reducedMotion() || typeof setInterval !== 'function') {
      el.textContent = txt; // reduced motion: full text at once
      typedFull = true;
      return;
    }
    el.textContent = '';
    typedFull = false;
    var i = 0;
    typeTimer = setInterval(function () {
      if (!isShown()) { stopTyping(); return; } // closed via back/overlay
      i += 2;
      el.textContent = txt.slice(0, i);
      if (i >= txt.length) { stopTyping(); typedFull = true; }
    }, 18);
  }

  function nextAct() {
    if (!activeWorld) return;
    if (!typedFull) { // finish current act instantly, then advance on next tap
      stopTyping();
      var el = document.getElementById('story-act-text');
      if (el) el.textContent = activeWorld.story[actIdx];
      typedFull = true;
      return;
    }
    actIdx++;
    if (actIdx >= activeWorld.story.length) { close(); return; }
    try { if (typeof Audio !== 'undefined' && Audio.ui) Audio.ui(); } catch (e) {}
    renderAct();
  }

  function close() {
    stopTyping();
    var dlg = document.getElementById('dlg-story');
    if (dlg && dlg.classList) dlg.classList.remove('show');
    activeWorld = null;
  }

  // Skip button: end the whole cutscene immediately.
  function skip() {
    if (!activeWorld) { close(); return; }
    close();
  }

  // Open the cutscene for a world. Marks the story seen even when the
  // dialog is missing (never re-blocks gameplay on a broken asset).
  function openCutscene(world) {
    if (!world || !world.story || world.story.length < 3) return;
    try {
      markSeen(world.id);
      var dlg = document.getElementById('dlg-story');
      if (!dlg || !dlg.classList) return;
      activeWorld = world;
      actIdx = 0;
      renderAct();
      dlg.classList.add('show');
    } catch (e) {
      close();
    }
  }

  // Replay is always allowed from the map world card.
  function replay(world) { openCutscene(world); }

  function wire() {
    var btnNext = document.getElementById('story-continue');
    var btnSkip = document.getElementById('story-skip');
    if (btnNext) btnNext.addEventListener('click', function (e) { e.preventDefault(); nextAct(); });
    if (btnSkip) btnSkip.addEventListener('click', function (e) { e.preventDefault(); skip(); });
  }

  try { if (typeof document !== 'undefined') wire(); } catch (e) {}

  var api = {
    WORLDS: WORLDS,
    worldForLevel: worldForLevel,
    portraitFor: portraitFor,
    worldStars: worldStars,
    starChestReady: starChestReady,
    hasSeen: hasSeen,
    markSeen: markSeen,
    pendingWorld: pendingWorld,
    openCutscene: openCutscene,
    replay: replay,
    close: close,
    reducedMotion: reducedMotion
  };
  if (typeof globalThis !== 'undefined') globalThis.ArrowOutStory = api;
  return api;
})();
