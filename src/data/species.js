// Species definitions: behaviour + body plan. Journal text lives in codex.js.
// arch: walker | hopper | crawler | flyer | swimmer | floater
// habitat: 'land' | 'water' | 'any'; hMin/hMax = terrain height band (swimmers: depth band below water).
export const SPECIES = {
  // ---- KHEPRI ----
  dune_strider: {
    id: 'dune_strider', planet: 'khepri', arch: 'walker', diet: 'herbivore', len: 2.6, hgt: 1.5, legs: 4,
    color: 0xb98a5a, color2: 0xe7cf9a, feat: ['sail'], herd: [3, 6], speed: 2.2, run: 9, fleeDist: 38,
    habitat: 'land', hMin: 20, hMax: 400, freq: 3, tone: 180, behaviors: ['grazing', 'fleeing', 'herding'],
  },
  cinder_skitter: {
    id: 'cinder_skitter', planet: 'khepri', arch: 'crawler', diet: 'omnivore', len: 0.7, hgt: 0.35, legs: 6,
    color: 0x2a2523, color2: 0xff7a30, feat: ['glowback'], herd: [2, 5], speed: 1.4, run: 6.5, fleeDist: 14,
    habitat: 'land', hMin: 0, hMax: 400, freq: 2.5, nocturnal: true, tone: 620, behaviors: ['resting', 'calling'],
  },
  rift_stalker: {
    id: 'rift_stalker', planet: 'khepri', arch: 'walker', diet: 'carnivore', prey: ['dune_strider'], len: 3.2, hgt: 1.3, legs: 4,
    color: 0x4a3a35, color2: 0x9b2f22, feat: ['horns'], herd: [1, 1], speed: 2.4, run: 12, fleeDist: 0, aggro: true,
    habitat: 'land', hMin: 0, hMax: 400, freq: 0.9, tone: 90, behaviors: ['hunting', 'resting'],
  },
  // ---- VESPER ----
  mossback: {
    id: 'mossback', planet: 'vesper', arch: 'walker', diet: 'herbivore', len: 5.5, hgt: 2.6, legs: 4,
    color: 0x5a6b4a, color2: 0x7ad98a, feat: ['moss'], herd: [1, 3], speed: 1.3, run: 4, fleeDist: 14,
    habitat: 'land', hMin: 8, hMax: 300, freq: 2.2, tone: 110, behaviors: ['grazing', 'resting'],
  },
  lumen_choir: {
    id: 'lumen_choir', planet: 'vesper', arch: 'flyer', diet: 'omnivore', len: 0.9, hgt: 0.4, legs: 0,
    color: 0x2a3a5a, color2: 0x6affea, feat: ['glowdots'], herd: [5, 9], speed: 6, run: 11, fleeDist: 10,
    habitat: 'any', hMin: 0, hMax: 600, freq: 2, tone: 520, behaviors: ['calling', 'herding'],
    anchor: { site: 'v_grove', radius: 150 },
  },
  thornhopper: {
    id: 'thornhopper', planet: 'vesper', arch: 'hopper', diet: 'omnivore', len: 1.1, hgt: 0.7, legs: 2,
    color: 0x8a5a7a, color2: 0xe0c060, feat: ['spines'], herd: [2, 4], speed: 2, run: 8, fleeDist: 22,
    habitat: 'land', hMin: 8, hMax: 300, freq: 3, tone: 380, behaviors: ['fleeing', 'grazing'],
  },
  veil_prowler: {
    id: 'veil_prowler', planet: 'vesper', arch: 'walker', diet: 'carnivore', prey: ['thornhopper'], len: 2.4, hgt: 1.1, legs: 4,
    color: 0x1c2a3a, color2: 0x5affc8, feat: ['glowdots', 'horns'], herd: [1, 2], speed: 2.1, run: 11, fleeDist: 0,
    habitat: 'land', hMin: 8, hMax: 300, freq: 0.8, nocturnal: true, tone: 140, behaviors: ['hunting', 'resting'],
  },
  // ---- NIVALIS ----
  glacier_drifter: {
    id: 'glacier_drifter', planet: 'nivalis', arch: 'floater', diet: 'filter', len: 3, hgt: 2.2, legs: 0,
    color: 0xbfe8ff, color2: 0x7fb8ff, feat: ['glowdots'], herd: [2, 4], speed: 1.2, run: 3, fleeDist: 0,
    habitat: 'land', hMin: -50, hMax: 600, freq: 2, tone: 300, behaviors: ['calling', 'herding'],
  },
  frost_burrower: {
    id: 'frost_burrower', planet: 'nivalis', arch: 'walker', diet: 'herbivore', len: 1.8, hgt: 0.9, legs: 4,
    color: 0xd8e4f0, color2: 0x8aa0c0, feat: ['armor'], herd: [3, 6], speed: 1.6, run: 6, fleeDist: 26,
    habitat: 'land', hMin: -50, hMax: 600, freq: 3, tone: 210, behaviors: ['resting', 'herding', 'grazing'],
  },
  ice_wraith: {
    id: 'ice_wraith', planet: 'nivalis', arch: 'walker', diet: 'carnivore', prey: ['frost_burrower'], len: 3, hgt: 1.5, legs: 4,
    color: 0xe6f1ff, color2: 0x3a6aa8, feat: ['horns', 'spines'], herd: [1, 1], speed: 2.3, run: 12, fleeDist: 0, aggro: true,
    habitat: 'land', hMin: -50, hMax: 600, freq: 0.8, tone: 100, behaviors: ['hunting', 'resting'],
  },
  // ---- PELAGOS ----
  shore_crab: {
    id: 'shore_crab', planet: 'pelagos', arch: 'crawler', diet: 'omnivore', len: 0.8, hgt: 0.4, legs: 6,
    color: 0xd06a4a, color2: 0xf0d8a0, feat: ['claws'], herd: [3, 7], speed: 1.2, run: 5, fleeDist: 12,
    habitat: 'land', hMin: 0.8, hMax: 40, freq: 3, tone: 700, behaviors: ['grazing', 'fleeing'],
  },
  reef_shoal: {
    id: 'reef_shoal', planet: 'pelagos', arch: 'swimmer', diet: 'omnivore', len: 0.5, hgt: 0.18, legs: 0, shape: 'fish',
    color: 0x3aa8d8, color2: 0xffe070, feat: [], herd: [9, 16], speed: 2.6, run: 7, fleeDist: 12,
    habitat: 'water', hMin: 2, hMax: 55, freq: 4, tone: 450, behaviors: ['herding', 'fleeing'],
  },
  tidal_skate: {
    id: 'tidal_skate', planet: 'pelagos', arch: 'swimmer', diet: 'filter', len: 4.5, hgt: 0.5, legs: 0, shape: 'ray',
    color: 0x4a6a8a, color2: 0xa8e8ff, feat: ['glowdots'], herd: [1, 2], speed: 1.8, run: 4, fleeDist: 6,
    habitat: 'water', hMin: 6, hMax: 70, freq: 1.8, tone: 240, behaviors: ['grazing', 'calling'],
  },
  abyss_gulper: {
    id: 'abyss_gulper', planet: 'pelagos', arch: 'swimmer', diet: 'carnivore', prey: ['reef_shoal'], len: 5, hgt: 1.8, legs: 0, shape: 'gulper',
    color: 0x1a1f33, color2: 0x5affd0, feat: ['lure', 'glowdots'], herd: [1, 1], speed: 2, run: 9, fleeDist: 0, aggro: true,
    habitat: 'water', hMin: 40, hMax: 300, freq: 1, tone: 85, behaviors: ['hunting', 'resting'],
  },
  tidal_choir: {
    id: 'tidal_choir', planet: 'pelagos', arch: 'swimmer', diet: 'filter', len: 46, hgt: 7, legs: 0, shape: 'leviathan',
    color: 0x1b2c4a, color2: 0x6ae8ff, feat: ['glowdots'], herd: [1, 1], speed: 3, run: 6, fleeDist: 0,
    habitat: 'water', hMin: 60, hMax: 300, freq: 0, tone: 62, behaviors: ['calling', 'grazing'],
    anchor: { site: 'p_trench', radius: 350 }, colossal: true,
  },
};

export const SPECIES_BY_PLANET = {};
for (const s of Object.values(SPECIES)) (SPECIES_BY_PLANET[s.planet] ||= []).push(s);
