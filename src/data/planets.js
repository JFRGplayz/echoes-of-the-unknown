// Planet definitions. Everything planet-specific that is *data* lives here;
// terrain shaping lives in world/terrain.js, props in world/flora.js, life in data/species.js.
export const SYSTEM = {
  name: 'Aurelia',
  star: { radius: 52000, color: 0xfff1c9, glow: 0xffc27a },
};

export const PLANETS = {
  khepri: {
    id: 'khepri', name: 'Khepri', tagline: 'Arid canyon world',
    seed: 1101, radius: 8200, orbitPos: [-260000, 0, -110000],
    g: 9.2, dayLength: 1500, startHour: 0.3, axisTilt: 0.35,
    sky: { zenith: 0x2f5a96, horizon: 0xe2a174, ground: 0x4a2f22, night: 0x05060d, sun: 0xfff0d0, stars: 0.95 },
    fog: { day: 0xcf9a72, night: 0x090811, density: 0.00042 },
    light: { sun: 3.4, amb: 0.42 },
    temp: { max: 58, min: -52 }, o2Drain: 0.35, breathable: false, toxic: 0,
    weather: { list: [['clear', 6], ['sandstorm', 1]], interval: [260, 520] },
    terrainType: 'canyon', waterLevel: null,
    palette: { low: 0x5a2f1f, mid: 0xa5552d, high: 0xd69558, rock: 0x3d2a22, accent: 0xe3c18a },
    particle: { color: 0xd9b080, size: 0.28 },
    skyBodies: [{ size: 0.075, color: 0xc9b39a, dir: [-0.5, 0.55, -0.6] }],
    space: { base: 0xa4562e, accent: 0xe0a468, cloud: 0xe8c9a0, atmo: 0xff9a60, bands: 0.2 },
  },
  vesper: {
    id: 'vesper', name: 'Vesper', tagline: 'Living jungle world',
    seed: 2207, radius: 7600, orbitPos: [-60000, 0, 330000],
    g: 8.6, dayLength: 1380, startHour: 0.28, axisTilt: 0.2,
    sky: { zenith: 0x1a4f7a, horizon: 0x9fd6c4, ground: 0x1c3a30, night: 0x030812, sun: 0xfff8e0, stars: 0.8 },
    fog: { day: 0x7fb7a2, night: 0x04090c, density: 0.00085 },
    light: { sun: 2.8, amb: 0.5 },
    temp: { max: 34, min: 14 }, o2Drain: 0.08, breathable: true, toxic: 0,
    weather: { list: [['clear', 5], ['sporestorm', 1.4]], interval: [220, 480] },
    terrainType: 'jungle', waterLevel: 6,
    palette: { low: 0x1f4a3a, mid: 0x2f8a5c, high: 0x6a5aa8, rock: 0x4b3d34, accent: 0x7cf0d0 },
    particle: { color: 0xb6ffd8, size: 0.16 },
    skyBodies: [{ size: 0.05, color: 0xdfe8ff, dir: [0.6, 0.45, 0.4] }, { size: 0.025, color: 0xffd9b0, dir: [-0.3, 0.7, 0.6] }],
    space: { base: 0x2f8a5c, accent: 0x6a5aa8, cloud: 0xe8fff4, atmo: 0x7cf0d0, bands: 0.05 },
  },
  nivalis: {
    id: 'nivalis', name: 'Nivalis', tagline: 'Frozen signal world',
    seed: 3313, radius: 9100, orbitPos: [430000, 0, 180000],
    g: 7.4, dayLength: 1700, startHour: 0.38, axisTilt: 0.5,
    sky: { zenith: 0x18305a, horizon: 0xaec8e8, ground: 0x6a7f9a, night: 0x02040c, sun: 0xdfeaff, stars: 1.0 },
    fog: { day: 0xa9c0de, night: 0x050a14, density: 0.00060 },
    light: { sun: 2.6, amb: 0.55 },
    temp: { max: -12, min: -78 }, o2Drain: 0.3, breathable: false, toxic: 0,
    weather: { list: [['clear', 5], ['blizzard', 1.6]], interval: [200, 420] },
    terrainType: 'glacier', waterLevel: null,
    palette: { low: 0x8fb4d8, mid: 0xe4f0fb, high: 0xffffff, rock: 0x3a465a, accent: 0x7fd8ff },
    particle: { color: 0xffffff, size: 0.2 },
    skyBodies: [{ size: 0.2, color: 0x8fa8d8, dir: [0.2, 0.5, -0.8] }],
    space: { base: 0xdbe8f6, accent: 0x7fb0e0, cloud: 0xffffff, atmo: 0x9ad0ff, bands: 0.02 },
  },
  pelagos: {
    id: 'pelagos', name: 'Pelagos', tagline: 'Ocean world',
    seed: 4421, radius: 8800, orbitPos: [150000, 0, -460000],
    g: 9.0, dayLength: 1450, startHour: 0.33, axisTilt: 0.25,
    sky: { zenith: 0x1f5f9f, horizon: 0xbfe0f0, ground: 0x1d4a66, night: 0x040a16, sun: 0xfffbe8, stars: 0.85 },
    fog: { day: 0x9fd0e6, night: 0x050c16, density: 0.00055 },
    light: { sun: 3.0, amb: 0.5 },
    temp: { max: 31, min: 16 }, o2Drain: 0.12, breathable: true, toxic: 0,
    weather: { list: [['clear', 5], ['tempest', 1.3]], interval: [240, 500] },
    terrainType: 'archipelago', waterLevel: 0,
    islands: [
      { x: 0, z: 0, r: 520, h: 42 }, { x: 2300, z: -900, r: 420, h: 38 }, { x: 900, z: 1500, r: 300, h: 30 },
      { x: -1500, z: -1300, r: 380, h: 36 }, { x: -900, z: 1300, r: 260, h: 24 },
      { x: 1700, z: 900, r: 170, h: -14 },
    ],
    trench: { x: -2600, z: 2300, r: 650, depth: 230 },
    palette: { low: 0x2b5a6e, mid: 0xe2d6a8, high: 0x4fa36a, rock: 0x4a4e58, accent: 0x7fe8e0 },
    particle: { color: 0xcfeaff, size: 0.12 },
    skyBodies: [{ size: 0.06, color: 0xf2f0ff, dir: [-0.6, 0.5, 0.5] }],
    space: { base: 0x1b5aa0, accent: 0x4fa36a, cloud: 0xffffff, atmo: 0x6ac0ff, bands: 0.03 },
  },
};

export const PLANET_ORDER = ['khepri', 'vesper', 'nivalis', 'pelagos'];

// Planetary surface <-> orbit mapping (1 radian of lon/lat = SURFACE_SCALE metres on the flat-ish surface map).
export const SURFACE_SCALE = 18000;
