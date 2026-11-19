// Handcrafted points of interest, cross-discovery links (the "connected discoveries" system),
// open questions, and the Orrin trading post.
// Site coordinates are in planet-local metres. `scans` are the investigation points of a site: each names
// a journal entry and the fact keys revealed there ('keys'), so one structure needs several investigations.

export const SITES = {
  khepri: [
    { id: 'k_pad', type: 'pad', x: 0, z: 0, r: 16, label: 'Landing Zone', hint: false },
    { id: 'k_station', type: 'station', x: 380, z: -260, r: 38, label: 'Kestrel-7 Station', hint: true,
      scans: [{ entry: 'kestrel_station', keys: ['id'], off: [0, 2.5, 0], r: 22 }],
      logs: [{ id: 'kestrel_log_1', off: [6, 1.3, 4] }, { id: 'kestrel_log_2', off: [-5, 1.3, 7] }, { id: 'kestrel_log_3', off: [0, 1.3, -9] }] },
    { id: 'k_pylon', type: 'pylon', x: -900, z: 1100, r: 46, label: 'Observatory Pylon', hint: true, rad: 0.12,
      scans: [
        { entry: 'khepri_pylon', keys: ['id', 'arch'], off: [0, 14, 0], r: 26 },
        { entry: 'khepri_pylon', keys: ['inscr'], off: [0, 2.2, 7.5], r: 5, label: 'Inscription band' },
        { entry: 'khepri_pylon', keys: ['mach'], off: [0, 1.4, -4], r: 5, label: 'Core ring' },
        { entry: 'resonance_node', keys: ['id'], off: [-8, 1.4, 6], r: 4 },
        { entry: 'harmonic_hum', keys: ['id', 'deep'], off: [0, 3, 0], r: 40 },
      ],
      digs: [{ id: 'k_dig1', off: [20, 0, 14], frag: 'frag_1' }] },
    { id: 'k_cavern', type: 'cavern', x: 1500, z: 700, r: 58, label: 'Echo Cavern', hint: true, rad: 0.18, shelter: true,
      scans: [
        { entry: 'echo_cavern', keys: ['id'], off: [0, 4, 24], r: 14 },
        { entry: 'echo_cavern', keys: ['mach'], off: [0, 3, -12], r: 8, label: 'Resonant chamber' },
        { entry: 'harmonic_hum', keys: ['id', 'deep'], off: [0, 3, 0], r: 30 },
      ],
      nodes: [{ res: 'echolite', off: [6, 0.5, -14] }, { res: 'echolite', off: [-7, 0.5, -10] }, { res: 'echolite', off: [2, 0.5, -20] }] },
    { id: 'k_fulgurite', type: 'geo_fulgurite', x: -1600, z: -700, r: 30, label: 'Fulgurite Field', hint: false,
      scans: [{ entry: 'fulgurite_field', keys: ['id', 'deep'], off: [0, 2, 0], r: 24 }],
      nodes: [{ res: 'silicate_glass', off: [4, 0.5, 3] }, { res: 'silicate_glass', off: [-6, 0.5, -2] }] },
    { id: 'k_canyon', type: 'geo_canyon', x: 700, z: 1700, r: 22, label: 'Strata Overlook', hint: false,
      scans: [{ entry: 'layered_canyon', keys: ['id', 'deep'], off: [0, 3, 0], r: 24 }] },
    { id: 'k_wreck', type: 'wreck', x: -300, z: -900, r: 24, label: 'Lander Marigold', hint: true,
      scans: [{ entry: 'marigold_wreck', keys: ['id'], off: [0, 2, 0], r: 16 }],
      logs: [{ id: 'marigold_log', off: [3, 1.2, 2] }] },
  ],
  vesper: [
    { id: 'v_pad', type: 'pad', x: 0, z: 0, r: 16, label: 'Landing Zone', hint: false },
    { id: 'v_grove', type: 'grove', x: -700, z: 900, r: 50, label: 'Chorus Grove', hint: true,
      scans: [{ entry: 'chorus_light', keys: ['id', 'deep'], off: [0, 3, 0], r: 45 }] },
    { id: 'v_spire', type: 'spire', x: 1100, z: -800, r: 50, label: 'Overgrown Spire', hint: false, hidden: true, rad: 0,
      scans: [
        { entry: 'vesper_spire', keys: ['id', 'arch'], off: [0, 12, 0], r: 24 },
        { entry: 'vesper_spire', keys: ['inscr'], off: [0, 2, 7.5], r: 5, label: 'Inscription band' },
        { entry: 'vesper_spire', keys: ['mach'], off: [0, 1.4, -4], r: 5, label: 'Buried core' },
      ],
      digs: [{ id: 'v_dig1', off: [-18, 0, 12], frag: 'frag_2' }] },
    { id: 'v_sinkhole', type: 'geo_sinkhole', x: 300, z: 1500, r: 28, label: 'Karst Sinkhole', hint: false,
      scans: [{ entry: 'karst_sinkhole', keys: ['id', 'deep'], off: [0, 1, 0], r: 28 }] },
  ],
  nivalis: [
    { id: 'n_pad', type: 'pad', x: 0, z: 0, r: 16, label: 'Landing Zone', hint: false },
    { id: 'n_arch', type: 'arch', x: 1300, z: 400, r: 58, label: 'Buried Triad Arch', hint: true, rad: 0.3,
      scans: [
        { entry: 'nivalis_arch', keys: ['id', 'arch'], off: [0, 16, 0], r: 30 },
        { entry: 'nivalis_arch', keys: ['inscr'], off: [0, 2.2, 9], r: 5, label: 'Inscription band' },
        { entry: 'nivalis_arch', keys: ['mach'], off: [0, 1.4, -5], r: 5, label: 'Emitter core' },
        { entry: 'echo_signal', keys: ['id', 'deep'], off: [0, 4, 0], r: 40 },
      ],
      digs: [{ id: 'n_dig1', off: [22, 0, -14], frag: 'frag_3' }] },
    { id: 'n_static', type: 'static', x: 200, z: 900, r: 120, label: 'Aurora Static', hint: true, rad: 0.2, flat: false,
      scans: [{ entry: 'aurora_static', keys: ['id', 'deep'], off: [0, 3, 0], r: 60 }] },
    { id: 'n_icecave', type: 'icecave', x: -900, z: -1200, r: 50, label: 'Glacial Ice Cave', hint: false, shelter: true,
      scans: [{ entry: 'ice_cave', keys: ['id', 'deep'], off: [0, 3, -4], r: 22 }],
      nodes: [{ res: 'cryo_salt', off: [5, 0.5, -10] }, { res: 'cryo_salt', off: [-6, 0.5, -14] }, { res: 'echolite', off: [0, 0.5, -20] }] },
    { id: 'n_ridge', type: 'geo_ridge', x: 500, z: -1500, r: 30, label: 'Pressure Ridge', hint: false,
      scans: [{ entry: 'pressure_ridge', keys: ['id', 'deep'], off: [0, 3, 0], r: 24 }],
      nodes: [{ res: 'deuterium_ice', off: [5, 0.5, 4] }, { res: 'deuterium_ice', off: [-5, 0.5, -3] }] },
    { id: 'n_vault', type: 'vault', x: -2200, z: 1800, r: 72, label: 'Deep Vault', hint: false, hidden: true, rad: 0.3,
      scans: [
        { entry: 'nivalis_vault', keys: ['id', 'arch'], off: [0, 8, 0], r: 24 },
        { entry: 'nivalis_vault', keys: ['mach'], off: [0, 3, 3], r: 20, label: 'Door' },
        { entry: 'echo_core', keys: ['first', 'truth', 'ask'], off: [0, 3, -30], r: 10, label: 'Echo Core', needsFlag: 'vault_open' },
      ] },
  ],
  pelagos: [
    { id: 'p_pad', type: 'pad', x: 0, z: 0, r: 16, label: 'Landing Zone', hint: false },
    { id: 'p_concord', type: 'ring', x: 2650, z: -1650, r: 80, h: -52, label: 'Drowned Concord', hint: true, depthNeeded: 40,
      scans: [
        { entry: 'pelagos_concord', keys: ['id', 'arch'], off: [0, 10, 0], r: 40 },
        { entry: 'pelagos_concord', keys: ['inscr'], off: [0, 2, 12], r: 6, label: 'Inscription band' },
        { entry: 'pelagos_concord', keys: ['mach'], off: [0, 2, -6], r: 6, label: 'Echolite array' },
      ],
      digs: [{ id: 'p_dig1', off: [-14, 0, 10], frag: 'frag_4' }],
      nodes: [{ res: 'echolite', off: [8, 0.5, 6] }] },
    { id: 'p_vent', type: 'geo_vent', x: 400, z: -1100, r: 30, h: -48, label: 'Hydrothermal Vent', hint: false,
      scans: [{ entry: 'hydrothermal_vent', keys: ['id', 'deep'], off: [0, 3, 0], r: 26 }],
      nodes: [{ res: 'deuterium_ice', off: [6, 0.5, 4] }] },
    { id: 'p_seamount', type: 'geo_seamount', x: 1700, z: 900, r: 40, h: -14, label: 'Seamount Summit', hint: false,
      scans: [{ entry: 'seamount', keys: ['id', 'deep'], off: [0, 2, 0], r: 30 }],
      nodes: [{ res: 'aqua_pearl', off: [5, 0.5, 5] }, { res: 'aqua_pearl', off: [-6, 0.5, 0] }] },
    { id: 'p_trench', type: 'trench', x: -2600, z: 2300, r: 40, label: 'The Trench', hint: true, noFlatten: true },
  ],
};

// Space locations are placed by world/space.js; keys listed here are used for journal reveal/hints.
export const SPACE_HINTS = ['orbital_ring', 'calloway', 'tessera', 'signal'];

// Cross-discovery links. Order independent: when every fact in `needs` is known, the link fires once.
export const LINKS = [
  { id: 'tones', name: 'The Three Tones',
    needs: ['harmonic_hum:id', 'lumen_choir:obs:calling'],
    text: 'The Lumen Choir\'s song and the Khepri Hum share the same three tones, in the same ratios. A bird and a mineral, a thousand light-years of mud apart, are singing together. Somewhere on Vesper, a structure should carry the same tone.',
    flags: ['tone_a'], reveal: ['v_spire'],
    question: 'Why do a bird on Vesper and a crystal on Khepri share one song?' },
  { id: 'triad', name: 'The Triad Pattern',
    needs: ['khepri_pylon:arch', 'vesper_spire:arch', 'nivalis_arch:arch'],
    text: 'Three structures on three different worlds share a single design: three arcs joined at a ring. The pattern is deliberate: a key. Aligned with the Nivalis signal, it points beneath the glacier, where a sealed vault should wait.',
    flags: ['triad_key'], reveal: ['n_vault'],
    question: 'Three arcs, three worlds. What are the Anthelion\'s structures trying to open?' },
  { id: 'tidal', name: 'The Voice of the Deep',
    needs: ['tidal_choir:obs:calling', 'pelagos_concord:inscr'],
    text: 'The Concord was built to listen to the Tidal Choir. The leviathan\'s song carries the same three tones, but in the deep register: the other half of the key. The Anthelion tuned their machines to living singers.',
    flags: ['tone_b'], reveal: [],
    question: 'Why was a city built on the seabed to listen to a whale?' },
  { id: 'resonance', name: 'The Resonance Medium',
    needs: ['echolite:lab', 'echo_signal:id'],
    text: 'Echolite is the Anthelion\'s medium: it carries their signal, powers their machines and is woven into life on three worlds. With enough echolite and relic alloy, a Resonance Tuner could be built to speak back.',
    flags: ['resonance'], reveal: [],
    question: 'What is echolite, and why is it inside everything?' },
  { id: 'anthelion1', name: 'Those Who Listen', needs: ['khepri_pylon:inscr'],
    text: 'The inscription names the builders: the Anthelion. The name means "those who listen". Evidence of them now appears throughout the region.',
    flags: [], reveal: [], grant: ['anthelion:first'], question: null },
  { id: 'anthelion2', name: 'Tissue and Crystal', needs: ['echolite:lab', 'lumen_choir:lab'],
    text: 'Echolite appears in animal tissue as well as structures. The Anthelion technology was partly biological.',
    flags: [], reveal: [], grant: ['anthelion:tech'], question: null },
];

// Standing questions. Each is answered when its fact becomes known.
export const QUESTIONS = [
  { id: 'q_builders', text: 'Who built the spires?', answeredBy: 'khepri_pylon:inscr' },
  { id: 'q_signal', text: 'What is the Nivalis signal, and who is it for?', answeredBy: 'nivalis_arch:mach' },
  { id: 'q_vault', text: 'What is sealed beneath Nivalis?', answeredBy: 'echo_core:first' },
  { id: 'q_gone', text: 'Where did the Anthelion go?', answeredBy: 'echo_core:truth' },
  { id: 'q_listeners', text: 'Whom are the Anthelion waiting to hear?', answeredBy: null },
];

export const ORRIN = {
  greeting: 'Light-and-tone greeting. We are the Orrin. You have a listener\'s look.',
  topics: [
    { id: 'who', label: 'Who are you?', text: 'We carry what is known from star to star. Trade us what you know and we will trade back.', grant: ['orrin:first', 'orrin:culture'] },
    { id: 'listeners', label: 'Do you know of the ring above Nivalis?', text: 'The ring is older than our oldest song. We do not approach. We call its makers "the Listeners", and we think they are still listening. Check the ring: it carries a chart.', reveal: 'orbital_ring' },
    { id: 'kharn', label: 'The Reclaimers at the wreck?', text: 'Kharn. They hail once. Keep your distance from the derelict, or move fast. Do not argue with them.', grant: ['kharn:first', 'kharn:culture'] },
  ],
  offers: [
    { id: 'o1', give: { ferrolith: 8 }, get: { fuel: 50 }, label: '8 Ferrolith for 50% fuel' },
    { id: 'o2', give: { biogel: 6 }, get: { res: { silicate_glass: 5 } }, label: '6 Bio-gel for 5 Silicate Glass' },
    { id: 'o3', give: { aqua_pearl: 3 }, get: { res: { echolite: 3 } }, label: '3 Aqua Pearl for 3 Echolite' },
    { id: 'o4', give: { cryo_salt: 6 }, get: { res: { ferrolith: 8 } }, label: '6 Cryo-salt for 8 Ferrolith' },
    { id: 'o5', give: { relic_alloy: 1 }, get: { res: { echolite: 4, aqua_pearl: 2 } }, label: '1 Relic Alloy for 4 Echolite, 2 Aqua Pearl' },
    { id: 'o6', give: { deuterium_ice: 4 }, get: { fuel: 40, repair: 25 }, label: '4 Deuterium Ice for 40% fuel & 25% hull' },
  ],
};
