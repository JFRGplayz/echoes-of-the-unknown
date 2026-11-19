// Upgrade groups. A level is purchasable when its requirement (journal fact or flag) is satisfied
// and the cost is in the inventory. 'stats' accumulate: the highest purchased level of each group applies.
export const RES_NAMES = {
  ferrolith: 'Ferrolith', silicate_glass: 'Silicate Glass', echolite: 'Echolite', biogel: 'Bio-gel',
  cryo_salt: 'Cryo-salt', deuterium_ice: 'Deuterium Ice', aqua_pearl: 'Aqua Pearl', relic_alloy: 'Relic Alloy',
};
export const RES_COLORS = {
  ferrolith: 0xb0623a, silicate_glass: 0xbfe6e0, echolite: 0xa27bff, biogel: 0x7ae08a,
  cryo_salt: 0x9ad8ff, deuterium_ice: 0xdff6ff, aqua_pearl: 0xf0e6ff, relic_alloy: 0x9a8fb0,
};

export const UPGRADES = [
  // ---------------- SUIT ----------------
  { id: 'scanner', name: 'Scanner', kind: 'equip', levels: [
    { name: 'Field Scanner Mk I', cost: {}, stats: { scanTier: 1, scanRange: 40 }, desc: 'Basic organism, mineral and structure scanning.' },
    { name: 'Field Scanner Mk II', cost: { ferrolith: 6, silicate_glass: 4 }, stats: { scanTier: 2, scanRange: 70 }, desc: 'Reveals deeper physiology, composition and inscriptions.' },
    { name: 'Resonant Scanner Mk III', cost: { echolite: 4, relic_alloy: 2 }, req: { fact: 'echolite:id' }, stats: { scanTier: 3, scanRange: 110 }, desc: 'Echolite-tuned scanner. Longer range, finest detail.' },
  ] },
  { id: 'thermal', name: 'Thermal Protection', kind: 'equip', levels: [
    { name: 'Standard Suit', cost: {}, stats: { thermMin: -25, thermMax: 45 }, desc: 'Handles temperate extremes.' },
    { name: 'Insulated Suit', cost: { silicate_glass: 6, ferrolith: 4 }, req: { fact: 'silicate_glass:lab' }, stats: { thermMin: -55, thermMax: 75 }, desc: 'Fused-silicate layers for desert and mild cold.' },
    { name: 'Cryo-Regulated Suit', cost: { cryo_salt: 8, silicate_glass: 4 }, req: { fact: 'cryo_salt:lab' }, stats: { thermMin: -95, thermMax: 95 }, desc: 'Coolant brine loop for the deep freeze.' },
  ] },
  { id: 'filter', name: 'Toxin Filter', kind: 'equip', levels: [
    { name: 'Basic Filter', cost: {}, stats: { filter: 0 }, desc: 'No special protection.' },
    { name: 'Bio-gel Filter', cost: { biogel: 6, ferrolith: 2 }, req: { fact: 'biogel:lab' }, stats: { filter: 1 }, desc: 'Handles spore storms and mild toxins.' },
    { name: 'Resonant Filter', cost: { biogel: 8, echolite: 2 }, req: { fact: 'biogel:lab' }, stats: { filter: 2 }, desc: 'Full filtering of airborne particulates.' },
  ] },
  { id: 'rad', name: 'Radiation Shielding', kind: 'equip', levels: [
    { name: 'No shielding', cost: {}, stats: { radShield: 0 }, desc: 'Standard hull plating only.' },
    { name: 'Shielded Lining', cost: { ferrolith: 6, echolite: 3 }, req: { fact: 'harmonic_hum:id' }, stats: { radShield: 0.35 }, desc: 'Absorbs low-level energy and radiation.' },
    { name: 'Resonant Shielding', cost: { relic_alloy: 3, echolite: 4 }, req: { fact: 'anthelion:tech' }, stats: { radShield: 0.7 }, desc: 'Re-emits harmful energy as harmless tone.' },
  ] },
  { id: 'pressure', name: 'Pressure Rating', kind: 'equip', levels: [
    { name: 'Standard Shell', cost: {}, stats: { depthMax: 25 }, desc: 'Safe to 25 m.' },
    { name: 'Pearl Shell', cost: { aqua_pearl: 5, ferrolith: 5 }, req: { fact: 'aqua_pearl:lab' }, stats: { depthMax: 90 }, desc: 'Pearl-lattice shell, safe to 90 m.' },
    { name: 'Deep Shell', cost: { aqua_pearl: 8, relic_alloy: 2 }, req: { fact: 'pelagos_concord:id' }, stats: { depthMax: 320 }, desc: 'Safe to 320 m. The deep trench is within reach.' },
  ] },
  { id: 'o2', name: 'Oxygen Reserve', kind: 'equip', levels: [
    { name: 'Standard Tank', cost: {}, stats: { o2Max: 100 }, desc: '100 units.' },
    { name: 'Extended Tank', cost: { ferrolith: 5, silicate_glass: 3 }, stats: { o2Max: 170 }, desc: '170 units.' },
    { name: 'Deep Tank', cost: { ferrolith: 8, aqua_pearl: 3 }, stats: { o2Max: 260 }, desc: '260 units.' },
  ] },
  { id: 'battery', name: 'Suit Battery', kind: 'equip', levels: [
    { name: 'Cell Mk I', cost: {}, stats: { energyMax: 100 }, desc: '100 units.' },
    { name: 'Cell Mk II', cost: { ferrolith: 4, biogel: 3 }, stats: { energyMax: 170 }, desc: '170 units.' },
    { name: 'Cell Mk III', cost: { echolite: 3, silicate_glass: 4 }, stats: { energyMax: 260 }, desc: '260 units.' },
  ] },
  { id: 'mining', name: 'Mining Laser', kind: 'equip', levels: [
    { name: 'Laser Mk I', cost: {}, stats: { mineRate: 1 }, desc: 'Basic extraction.' },
    { name: 'Laser Mk II', cost: { ferrolith: 6 }, req: { fact: 'ferrolith:lab' }, stats: { mineRate: 1.9 }, desc: 'Nearly doubles extraction speed.' },
    { name: 'Laser Mk III', cost: { ferrolith: 8, echolite: 3 }, stats: { mineRate: 3 }, desc: 'Resonant cutting head.' },
  ] },
  { id: 'excavator', name: 'Excavator', kind: 'equip', levels: [
    { name: 'None', cost: {}, stats: { excavator: 0 }, desc: '' },
    { name: 'Survey Excavator', cost: { ferrolith: 8, silicate_glass: 4 }, req: { fact: 'kestrel_log_2:log' }, stats: { excavator: 1 }, desc: 'Fine excavation of buried sites. Unlocks Tool 3.' },
  ] },
  { id: 'jetpack', name: 'Jetpack', kind: 'equip', levels: [
    { name: 'Jet Mk I', cost: {}, stats: { jet: 1 }, desc: 'Short hops.' },
    { name: 'Jet Mk II', cost: { ferrolith: 6, biogel: 3 }, stats: { jet: 1.8 }, desc: 'Longer, stronger thrust.' },
    { name: 'Jet Mk III', cost: { echolite: 3, relic_alloy: 1 }, stats: { jet: 2.8 }, desc: 'Resonant thruster, near-flight.' },
  ] },
  { id: 'tuner', name: 'Resonance Tuner', kind: 'equip', levels: [
    { name: 'None', cost: {}, stats: { tuner: 0 }, desc: '' },
    { name: 'Resonance Tuner', cost: { echolite: 6, relic_alloy: 4 }, req: { flag: 'resonance' }, stats: { tuner: 1 }, desc: 'Lets you speak the Anthelion\'s tone. Needed to open the Deep Vault.' },
  ] },
  // ---------------- SHIP ----------------
  { id: 'engine', name: 'Engine', kind: 'ship', levels: [
    { name: 'Drive Mk I', cost: {}, stats: { shipSpeed: 1, cruise: 20000 }, desc: 'Standard thrusters.' },
    { name: 'Drive Mk II', cost: { ferrolith: 10, silicate_glass: 5 }, stats: { shipSpeed: 1.3, cruise: 30000 }, desc: 'Faster in atmosphere and in cruise.' },
    { name: 'Resonant Drive Mk III', cost: { echolite: 5, relic_alloy: 3 }, stats: { shipSpeed: 1.7, cruise: 45000 }, desc: 'Echolite-tuned manifold.' },
  ] },
  { id: 'fuel', name: 'Fuel Tank', kind: 'ship', levels: [
    { name: 'Tank Mk I', cost: {}, stats: { fuelMax: 100 }, desc: '100 units.' },
    { name: 'Tank Mk II', cost: { ferrolith: 8, deuterium_ice: 4 }, stats: { fuelMax: 180 }, desc: '180 units.' },
    { name: 'Tank Mk III', cost: { ferrolith: 12, aqua_pearl: 4 }, stats: { fuelMax: 300 }, desc: '300 units.' },
  ] },
  { id: 'cargo', name: 'Cargo Hold', kind: 'ship', levels: [
    { name: 'Hold Mk I', cost: {}, stats: { cargo: 90 }, desc: '90 units.' },
    { name: 'Hold Mk II', cost: { ferrolith: 6 }, stats: { cargo: 170 }, desc: '170 units.' },
    { name: 'Hold Mk III', cost: { ferrolith: 10, silicate_glass: 6 }, stats: { cargo: 280 }, desc: '280 units.' },
  ] },
  { id: 'hull', name: 'Hull', kind: 'ship', levels: [
    { name: 'Hull Mk I', cost: {}, stats: { hullMax: 100 }, desc: '100 integrity.' },
    { name: 'Hull Mk II', cost: { ferrolith: 8, silicate_glass: 4 }, stats: { hullMax: 160 }, desc: '160 integrity.' },
    { name: 'Hull Mk III', cost: { relic_alloy: 3, ferrolith: 8 }, stats: { hullMax: 260 }, desc: '260 integrity.' },
  ] },
  { id: 'shipscan', name: 'Ship Scanner', kind: 'ship', levels: [
    { name: 'Scanner Mk I', cost: {}, stats: { shipScanRange: 6000 }, desc: 'Scans bodies and structures from 6 km.' },
    { name: 'Scanner Mk II', cost: { silicate_glass: 6, echolite: 2 }, req: { fact: 'harmonic_hum:id' }, stats: { shipScanRange: 20000 }, desc: 'Scans from 20 km.' },
  ] },
  { id: 'nav', name: 'Navigation Computer', kind: 'ship', levels: [
    { name: 'Nav Mk I', cost: {}, stats: { navRange: 400000, autopilot: 0 }, desc: 'Markers for known bodies.' },
    { name: 'Nav Mk II', cost: { ferrolith: 5, silicate_glass: 3 }, stats: { navRange: 2000000, autopilot: 1 }, desc: 'Full marker range and auto-align (G).' },
  ] },
];

// Outpost modules the player can deploy (B on foot).
export const OUTPOSTS = [
  { id: 'lab', name: 'Research Station', cost: { ferrolith: 6, silicate_glass: 3 }, desc: 'Analyse samples, craft upgrades, restore suit.' },
  { id: 'platform', name: 'Observation Platform', cost: { ferrolith: 4 }, desc: 'Elevated scanner post; boosts scan range nearby.' },
  { id: 'extractor', name: 'Resource Extractor', cost: { ferrolith: 8, silicate_glass: 4 }, desc: 'Slowly extracts local resources. Collect with E.' },
  { id: 'storage', name: 'Equipment Storage', cost: { ferrolith: 6 }, desc: 'Adds +40 cargo capacity while any exist.' },
  { id: 'monitor', name: 'Monitoring Station', cost: { ferrolith: 3, silicate_glass: 2 }, desc: 'Environmental station; recharges suit; shows forecast.' },
];

export function baseStats() {
  const s = {};
  for (const g of UPGRADES) Object.assign(s, g.levels[0].stats);
  return s;
}
