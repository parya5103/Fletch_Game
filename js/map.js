/**
 * Arrow Out! — Magical World Adventure Map (js/map.js)
 * Supports Levels 1–1,000 across 8 original fantasy chapters (125 levels/chapter)
 * with windowed viewport virtualization, winding SVG Bezier paths, landmark scenery,
 * and zero-regression integration with Storage (arrowOut.v2) and GameCore.
 */
(function (global) {
  'use strict';

  var TOTAL_LEVELS = 1000;
  var LEVELS_PER_CHAPTER = 125;
  var NODE_VERTICAL_SPACING = 88; // px between nodes along vertical scroll
  var MAP_TOP_PADDING = 130;
  var MAP_BOTTOM_PADDING = 140;
  var VIRTUAL_BUFFER_NODES = 18; // extra nodes above/below viewport

  var CHAPTERS = [
    {
      id: 1,
      name: 'Enchanted Meadow',
      subtitle: 'Sunlit Glades & Whispering Waystones',
      startLevel: 1,
      endLevel: 125,
      bgGradient: 'linear-gradient(180deg, #0f2922 0%, #133a2e 45%, #1b4d3e 100%)',
      pathOuter: '#2d5a44',
      pathInner: '#6ee7b7',
      pathActive: '#fbbf24',
      accent: '#34d399',
      accentGlow: 'rgba(52, 211, 153, 0.45)',
      nodeBg: '#164e3f',
      landmarkIcon: 'meadow',
      landmarks: ['Wayfarer Arch', 'Sunbeam Brook', 'Fletcher Cairn', 'Emerald Sanctum', 'Meadow Crown']
    },
    {
      id: 2,
      name: 'Whispering Woods',
      subtitle: 'Twilight Pines & Glowcap Hollows',
      startLevel: 126,
      endLevel: 250,
      bgGradient: 'linear-gradient(180deg, #111c35 0%, #172a4a 50%, #1e3a5f 100%)',
      pathOuter: '#2a3f66',
      pathInner: '#60a5fa',
      pathActive: '#f59e0b',
      accent: '#38bdf8',
      accentGlow: 'rgba(56, 189, 248, 0.45)',
      nodeBg: '#1e3a5f',
      landmarkIcon: 'woods',
      landmarks: ['Silver Owl Roost', 'Lantern Fern Bridge', 'Misty Hollow', 'Elderroot Gate', 'Sylvan Spire']
    },
    {
      id: 3,
      name: 'Crystal Caverns',
      subtitle: 'Resonant Quartz & Prism Streams',
      startLevel: 251,
      endLevel: 375,
      bgGradient: 'linear-gradient(180deg, #1e1338 0%, #2a1b4e 50%, #3b236b 100%)',
      pathOuter: '#432874',
      pathInner: '#c084fc',
      pathActive: '#22d3ee',
      accent: '#a855f7',
      accentGlow: 'rgba(168, 85, 247, 0.45)',
      nodeBg: '#311b59',
      landmarkIcon: 'crystal',
      landmarks: ['Amethyst Grotto', 'Mirror Geode', 'Prism Cascade', 'Echoing Obelisk', 'Heart of Quartz']
    },
    {
      id: 4,
      name: 'Moonlit Ruins',
      subtitle: 'Sunken Colonnades & Starlit Dials',
      startLevel: 376,
      endLevel: 500,
      bgGradient: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #27374d 100%)',
      pathOuter: '#334155',
      pathInner: '#94a3b8',
      pathActive: '#38bdf8',
      accent: '#818cf8',
      accentGlow: 'rgba(129, 140, 248, 0.45)',
      nodeBg: '#1e293b',
      landmarkIcon: 'ruins',
      landmarks: ['Collapsed Aqueduct', 'Astrolabe Plaza', 'Lunar Sundial', 'Runed Amphitheater', 'Temple of Tides']
    },
    {
      id: 5,
      name: 'Sky Islands',
      subtitle: 'Cloud Archipelagos & Wind Spires',
      startLevel: 501,
      endLevel: 625,
      bgGradient: 'linear-gradient(180deg, #0c2d48 0%, #14456b 50%, #1d5d8f 100%)',
      pathOuter: '#2563eb',
      pathInner: '#7dd3fc',
      pathActive: '#fde047',
      accent: '#38bdf8',
      accentGlow: 'rgba(125, 211, 252, 0.5)',
      nodeBg: '#164e78',
      landmarkIcon: 'sky',
      landmarks: ['Zephyr Dock', 'Floating Causeway', 'Gale Windmill', 'Nimbus Observatory', 'Aether Anchor']
    },
    {
      id: 6,
      name: "Dragon's Passage",
      subtitle: 'Obsidian Peaks & Ember Forges',
      startLevel: 626,
      endLevel: 750,
      bgGradient: 'linear-gradient(180deg, #2b1115 0%, #451a1c 50%, #5c241d 100%)',
      pathOuter: '#6b2722',
      pathInner: '#fb923c',
      pathActive: '#facc15',
      accent: '#f97316',
      accentGlow: 'rgba(249, 115, 22, 0.48)',
      nodeBg: '#4c1d1b',
      landmarkIcon: 'dragon',
      landmarks: ['Basalt Gate', 'Cinder Bridge', 'Wyrmscale Ridge', 'Anvil of Embers', 'Drakespire Vault']
    },
    {
      id: 7,
      name: 'Arcane Citadel',
      subtitle: 'Clockwork Towers & Mana Conduits',
      startLevel: 751,
      endLevel: 875,
      bgGradient: 'linear-gradient(180deg, #1a103c 0%, #2e1a63 50%, #3d2482 100%)',
      pathOuter: '#4c2d9c',
      pathInner: '#e879f9',
      pathActive: '#38bdf8',
      accent: '#d946ef',
      accentGlow: 'rgba(217, 70, 239, 0.48)',
      nodeBg: '#2e1a63',
      landmarkIcon: 'citadel',
      landmarks: ['Grand Athenaeum', 'Spellweaver Lift', 'Chronos Pendulum', 'Runic Conduit', 'Archmage Sanctum']
    },
    {
      id: 8,
      name: 'Eternal Eclipse',
      subtitle: 'Celestial Corona & The Final Castle',
      startLevel: 876,
      endLevel: 1000,
      bgGradient: 'linear-gradient(180deg, #090a14 0%, #16152b 48%, #261b47 100%)',
      pathOuter: '#3b2d66',
      pathInner: '#fbbf24',
      pathActive: '#f43f5e',
      accent: '#f59e0b',
      accentGlow: 'rgba(245, 158, 11, 0.55)',
      nodeBg: '#1f1938',
      landmarkIcon: 'eclipse',
      landmarks: ['Penumbra Threshold', 'Starfall Causeway', 'Solar Crown Gate', 'Astral Bastion', 'Sovereign Arrow Castle']
    }
  ];

  function getChapterForLevel(levelNum) {
    var clamped = Math.max(1, Math.min(TOTAL_LEVELS, Number(levelNum) || 1));
    var idx = Math.min(CHAPTERS.length - 1, Math.floor((clamped - 1) / LEVELS_PER_CHAPTER));
    return CHAPTERS[idx];
  }

  function getChapterById(chapterId) {
    for (var i = 0; i < CHAPTERS.length; i++) {
      if (CHAPTERS[i].id === Number(chapterId)) return CHAPTERS[i];
    }
    return CHAPTERS[0];
  }

  /**
   * Computes deterministic horizontal offset (-1 .. +1) along a smooth winding wave
   * so nodes form a natural S-curve adventure trail without layout shifts.
   */
  function getNodePosition(levelNum, chapter, viewportWidth) {
    var indexInChapter = levelNum - chapter.startLevel; // 0..124
    // Bottom-to-top or top-to-bottom? Mobile adventure games flow upward or downward cleanly;
    // We place node 1 at top or bottom consistently and auto-scroll directly to the active node.
    // Let's lay out indexInChapter from 0..124 with generous spacing and smooth S-curve:
    var y = MAP_TOP_PADDING + indexInChapter * NODE_VERTICAL_SPACING;
    var safeWidth = Math.max(280, Math.min(540, viewportWidth || 380));
    var amplitude = Math.min(130, (safeWidth - 130) * 0.44);
    var center = ( viewportWidth || 380 ) / 2;
    var phase = (indexInChapter / 3.2) * Math.PI + (chapter.id * 0.85);
    var x = Math.round(center + Math.sin(phase) * amplitude);
    return { x: x, y: y, indexInChapter: indexInChapter };
  }

  /**
   * Deterministically previews level metadata (grid size, arrow count, tier)
   * matching the game's progression curve without mutating active game state.
   */
  function getLevelPreviewMeta(levelNum) {
    var lvl = Math.max(1, Math.min(TOTAL_LEVELS, Number(levelNum) || 1));
    var gridSize = lvl <= 10 ? 4 : lvl <= 40 ? 5 : lvl <= 120 ? 6 : lvl <= 350 ? 7 : 8;
    var arrows = Math.min(gridSize * gridSize - 2, Math.round(8 + Math.sqrt(lvl) * 1.45 + (lvl % 5)));
    var tier = (lvl % 25 === 0) ? 'Chapter Boss Sanctuary' : (lvl % 10 === 0) ? 'Milestone Trial' : (lvl % 5 === 0) ? 'Hard Challenge' : 'Standard Path';
    var ch = getChapterForLevel(lvl);
    var subIdx = Math.min(4, Math.floor((lvl - ch.startLevel) / 25));
    var zoneName = ch.landmarks[subIdx];
    return {
      level: lvl,
      gridSize: gridSize,
      arrows: arrows,
      tier: tier,
      zoneName: zoneName,
      isMilestone: (lvl % 25 === 0 || lvl % 10 === 0)
    };
  }

  /**
   * Builds cubic Bezier SVG path string connecting nodes inside a chapter.
   */
  function buildSvgPath(points) {
    if (!points || !points.length) return '';
    var d = ['M ' + points[0].x + ' ' + points[0].y];
    for (var i = 1; i < points.length; i++) {
      var prev = points[i - 1];
      var curr = points[i];
      var midY = Math.round((prev.y + curr.y) / 2);
      d.push('C ' + prev.x + ' ' + midY + ', ' + curr.x + ' ' + midY + ', ' + curr.x + ' ' + curr.y);
    }
    return d.join(' ');
  }

  global.ArrowOutMap = {
    TOTAL_LEVELS: TOTAL_LEVELS,
    LEVELS_PER_CHAPTER: LEVELS_PER_CHAPTER,
    NODE_VERTICAL_SPACING: NODE_VERTICAL_SPACING,
    MAP_TOP_PADDING: MAP_TOP_PADDING,
    MAP_BOTTOM_PADDING: MAP_BOTTOM_PADDING,
    VIRTUAL_BUFFER_NODES: VIRTUAL_BUFFER_NODES,
    CHAPTERS: CHAPTERS,
    getChapterForLevel: getChapterForLevel,
    getChapterById: getChapterById,
    getNodePosition: getNodePosition,
    getLevelPreviewMeta: getLevelPreviewMeta,
    buildSvgPath: buildSvgPath
  };
})(typeof window !== 'undefined' ? window : globalThis);
