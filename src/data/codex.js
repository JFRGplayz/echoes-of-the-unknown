// The discovery database. Every journal entry is a list of facts; each fact is revealed by a
// specific kind of investigation (how): scan (with a minimum scanner tier / Anthelion lexicon),
// obs (watch a behaviour), lab (analyse a sample), log (read a record), dig (excavate), link (cross-reference).
export const CATEGORIES = [
  { id: 'planets', name: 'Planets' },
  { id: 'species', name: 'Species' },
  { id: 'flora', name: 'Flora' },
  { id: 'minerals', name: 'Minerals' },
  { id: 'geology', name: 'Geological Formations' },
  { id: 'structures', name: 'Ancient & Other Structures' },
  { id: 'civs', name: 'Civilisations' },
  { id: 'anomalies', name: 'Anomalies' },
  { id: 'history', name: 'Historical Discoveries' },
  { id: 'questions', name: 'Unanswered Questions' },
];

export const ENTRIES = {};
const add = (e) => {
  e.facts = e.facts.map((f) => ({ ...f, id: `${e.id}:${f.k}`, entry: e.id }));
  ENTRIES[e.id] = e;
};
const sc = (k, tier, text, extra = {}) => ({ k, how: 'scan', tier, text, ...extra });
const lab = (text) => ({ k: 'lab', how: 'lab', text });

function species(id, name, planet, ident, deep, obs, labText) {
  add({
    id, cat: 'species', name, planet,
    facts: [sc('id', 1, ident), sc('deep', 2, deep),
      ...Object.entries(obs).map(([b, text]) => ({ k: 'obs:' + b, how: 'obs', b, text })), lab(labText)],
  });
}
function flora(id, name, planet, ident, deep, labText) {
  add({ id, cat: 'flora', name, planet, facts: [sc('id', 1, ident), sc('deep', 2, deep), lab(labText)] });
}
function mineral(id, name, planet, ident, deep, labText) {
  add({ id, cat: 'minerals', name, planet, facts: [sc('id', 1, ident), sc('deep', 2, deep), lab(labText)] });
}
function geo(id, name, planet, ident, deep) {
  add({ id, cat: 'geology', name, planet, facts: [sc('id', 1, ident), sc('deep', 2, deep)] });
}

// ---------------------------------------------------------------- PLANETS
const planet = (id, name, orbital, atmos) => add({
  id, cat: 'planets', name, planet: id,
  facts: [
    { k: 'orbit', how: 'orbit', text: orbital },
    { k: 'atmos', how: 'land', text: atmos },
    { k: 'survey', how: 'link', text: 'Survey complete: enough of this world has been documented to compile a full surface survey.' },
  ],
});
planet('khepri', 'Khepri', 'Iron-oxide dust gives Khepri its rust-red face. Orbital radar shows a network of canyons cut by a long-vanished river system.',
  'Thin carbon-dioxide atmosphere, unbreathable. Daytime surface heat exceeds 55°C; nights fall below -50°C. Dust storms sweep the plateaus.');
planet('vesper', 'Vesper', 'A living green-violet world. Spectrometry shows dense photosynthetic coverage and persistent bioluminescent emission after dark.',
  'Breathable but thick with airborne spores. Mild temperatures. Violent spore storms overwhelm basic filters.');
planet('nivalis', 'Nivalis', 'A glacier-wrapped world. Ice-penetrating radar finds regular, artificial-looking geometry beneath the sheet, and a faint repeating signal.',
  'Thin, bitterly cold air. Temperatures never rise above -10°C. Blizzards reduce visibility to metres.');
planet('pelagos', 'Pelagos', 'Over 95% ocean. A scattering of islands, and one enormous trench with sonar returns too large to be geological.',
  'Breathable humid air above the waves. Below the surface, pressure climbs fast; suit ratings limit safe depth.');

// ---------------------------------------------------------------- SPECIES
species('dune_strider', 'Dune Strider', 'khepri',
  'A tall-legged grazer that travels in herds across the canyon plateaus.',
  'Hollow, heat-venting bones and a vascularised dorsal sail let it shed the day\'s heat without sweating away precious water.',
  { grazing: 'It crops stone moss with a scissoring beak, rotating the herd so no patch is stripped bare.',
    fleeing: 'At the first sign of a threat the herd bolts in a tight bunch, the sail flushing pale as an alarm.',
    herding: 'Herds keep a loose ring formation; juveniles walk at the centre, sentries at the edge.' },
  'Sail tissue contains a heat-exchanging fluid that stays liquid across a 120°C range. Useful for suit thermal regulation.');
species('cinder_skitter', 'Cinder Skitter', 'khepri',
  'A palm-sized nocturnal scavenger with glowing ember-orange seams along its back.',
  'The carapace is silica-rich glass; the glowing seams are stored geothermal heat bled slowly into the cold night.',
  { resting: 'By day, skitters wedge into rock crevices in clusters, their carapaces dulled to charcoal.',
    calling: 'Skitters click against rock in rhythmic bursts, answered by neighbours. The tempo matches the faint hum of nearby echolite.' },
  'Carapace crystals vibrate in sympathy with echolite. The resonance is not accidental: the species may navigate by it.');
species('rift_stalker', 'Rift Stalker', 'khepri',
  'A lean ambush predator with red-streaked flanks and bony brow-horns.',
  'Binocular vision and a long sprint stride; it can outrun a dune strider over ~300 metres but tires quickly.',
  { hunting: 'Stalkers shadow a herd for hours, then burst from cover, singling out a straggler.',
    resting: 'After a kill the stalker rests in canyon shade, motionless, defending the carcass.' },
  'Horn keratin is dense with silica. It conducts a slight electrical charge, perhaps sensing prey through ground vibration.');
species('mossback', 'Mossback', 'vesper',
  'A colossal, slow grazer whose back is an entire hanging garden of moss and small ferns.',
  'The moss is symbiotic: it feeds on the animal\'s waste heat and in return camouflages and cools it. Smaller creatures live in the garden.',
  { grazing: 'It browses on low canopy, pulling branches down with a prehensile lip while the garden on its back trembles.',
    resting: 'Resting mossbacks sink onto folded legs and are quickly mistaken for hills; birds and hoppers shelter against them.' },
  'The moss secretes a mild antibiotic gel that the Mossback spreads on wounds. Potential for suit-seal sealant.');
species('lumen_choir', 'Lumen Choir', 'vesper',
  'Small flocking gliders with bioluminescent wingtips. They sing in layered, rhythmic phrases.',
  'The song is not random: phrases repeat in a fixed order of three tones. Wingtip light pulses in time with the sound.',
  { calling: 'At dusk the flock gathers and sings the same three-tone sequence, over and over, wingtips pulsing in step.',
    herding: 'The flock holds a spiral formation as it climbs, each bird mirroring its neighbour\'s light.' },
  'Wing-light cells use a luciferase tuned to a very narrow band. The band matches the pulse frequency of echolite.');
species('thornhopper', 'Thornhopper', 'vesper',
  'A spined, rabbit-sized hopper that bounds through the undergrowth.',
  'Two powerful hind legs store elastic energy in a spring tendon. A single hop can cover eight metres.',
  { fleeing: 'Startled hoppers explode in every direction, a zig-zag chaos that confuses pursuit.',
    grazing: 'They crop glowing bulbs without being harmed by the toxins, carrying spores in their fur to the next patch.' },
  'Spines contain a mild neurotoxin. Neutralised, it is a useful base for filter compounds.');
species('veil_prowler', 'Veil Prowler', 'vesper',
  'A dark-furred nocturnal hunter with faintly luminous markings, near-invisible among the shadowed jungle.',
  'The markings can be switched off entirely. It hunts by darkness and by sound, lures prey with a faint glow, then strikes.',
  { hunting: 'The prowler dims its lights and creeps close, then flares them briefly to startle prey into the open.',
    resting: 'By day it curls in hollow roots, markings dim, unbothered by passers-by.' },
  'Photophore tissue stays active after death for hours; it contains a stable luminescent that could power low-energy lamps.');
species('glacier_drifter', 'Glacier Drifter', 'nivalis',
  'A translucent bell-bodied floater that drifts above the ice on trailing tendrils, glowing faintly blue.',
  'It maintains buoyancy by heating a trapped pocket of gas. Static charge in the tendrils attracts airborne ice dust to filter-feed.',
  { calling: 'Drifters emit pulses of static, flashing the tendrils. The pattern ripples through the group like a signal passed along.',
    herding: 'Groups drift together in the same direction, matching altitude and glow, an organised procession across the ice.' },
  'The tendril cells hold a charge for hours after death. A sample may help design suit batteries.');
species('frost_burrower', 'Frost Burrower', 'nivalis',
  'A stout, plated grazer that digs beneath the snow crust for lichen.',
  'Armour plates are layered ice and chitin, shedding blows from predators. Wide claws dig a den in minutes.',
  { resting: 'Groups huddle in shallow dens, backs together, sharing warmth through the long cold nights.',
    herding: 'Herds migrate in single file, each animal stepping in the trail of the one before.',
    grazing: 'They crack lichen mats with their claws and sieve the meltwater pools for nutrients.' },
  'Blood contains an antifreeze glycoprotein. Adapting the compound could improve suit thermal range.');
species('ice_wraith', 'Ice Wraith', 'nivalis',
  'A pale, long-limbed predator that blends into snow and moves with eerie quiet.',
  'Its white coat is a hollow-fibre insulation layer. It feels vibrations through the ice and tracks prey a kilometre away.',
  { hunting: 'It paces a herd at the edge of sight, waiting for a blizzard to cover its charge.',
    resting: 'After feeding the wraith lies motionless on exposed ridges, a pale shape almost invisible in the glare.' },
  'The hollow coat fibres trap air with extraordinary efficiency. Excellent insulation material.');
species('shore_crab', 'Shore Crab', 'pelagos',
  'A scuttling, armoured crab with one oversized claw, common along island shores.',
  'The big claw is used for signalling: waved in set patterns, it identifies the crab\'s colony.',
  { grazing: 'Crabs pull kelp wrack into narrow beaches and tear it apart with the small claw.',
    fleeing: 'Crabs sidestep into burrows or the surf when approached, claws raised in warning.' },
  'Shell chitin is laced with a mineral that resists seawater corrosion, possible for hull plating.');
species('reef_shoal', 'Reef Shoal', 'pelagos',
  'Small silver-blue fish that move in tight, shimmering shoals above the reef.',
  'Each fish senses neighbours through a lateral line. The shoal moves as one body, reacting to threats within milliseconds.',
  { herding: 'The shoal condenses and expands in waves, an animated cloud the same shape in every light.',
    fleeing: 'When a predator closes, the shoal explodes outward and re-forms behind it. A dazzle of scale-flash.' },
  'Scale pigments reflect through polarised layers. The cells might refine optical sensors.');
species('tidal_skate', 'Tidal Skate', 'pelagos',
  'A broad, graceful ray with glowing underwing patches and a long whip tail.',
  'It filters plankton with fine gill rakers while gliding. The wing-patches are used to communicate over long distances.',
  { grazing: 'The skate glides slowly through plankton blooms, mouth open, wings undulating in lazy waves.',
    calling: 'Skates flash their underwings in slow pulses, answered by distant skates beyond sight.' },
  'The underwing glow uses the same pigment family as the Lumen Choir. A shared ancestor, or something else?');
species('abyss_gulper', 'Abyss Gulper', 'pelagos',
  'A deep-water ambush predator, mostly mouth, with a dangling bioluminescent lure.',
  'Its jaw unhinges to swallow prey half its own size. The lure pulses at the frequency prey fish find most attractive.',
  { hunting: 'It hangs in the dark with the lure aglow, then lunges as curious prey arrive.',
    resting: 'Between meals the gulper sinks to the seabed and lies still, lure dimmed, digesting for days.' },
  'The lure\'s light organ glows without heat. Cold-light compounds like this are valuable for low-power lamps.');
species('tidal_choir', 'Tidal Choir', 'pelagos',
  'A colossal, slow-moving leviathan, nearly fifty metres long, trailing luminous bands along its flanks.',
  'Resonance chambers in its skull project infrasonic song for hundreds of kilometres. The song is built from the same three-tone sequence heard on Vesper.',
  { calling: 'It sings in deep pulsing phrases that rattle the suit. The pattern repeats with a three-tone structure and the bands flash in time.',
    grazing: 'The leviathan sweeps its jaws through dense plankton clouds, movements so slow they seem ceremonial.' },
  'The skin bands contain trace echolite, grown into the tissue. These animals are saturated with the substance, deliberately or not.');

// ---------------------------------------------------------------- FLORA
flora('stone_moss', 'Stone Moss', 'khepri', 'Low cushions of grey-gold lichen-like growth clinging to bare rock.',
  'It draws minerals from rock with acid secretions and stores water in glassy cells.', 'Water-storing cells are a natural desiccant; the gel is useful in suit seals.');
flora('glass_reed', 'Glass Reed', 'khepri', 'Slender, translucent reeds that chime softly in the wind.',
  'Silica-walled stalks channel light to the roots. Wind across the hollow tops produces a faint, tonal hum.', 'Silica fibre is exceptionally strong. Refined, it makes good optical glass.');
flora('hollow_barrel', 'Hollow Barrel', 'khepri', 'A squat, ribbed succulent holding a reservoir of water in its core.',
  'Ribs expand to store water after rare storms, and collapse to shade the core in drought.', 'The pulp is nutritious and the fibres harvestable.');
flora('sporetree', 'Spore Tree', 'vesper', 'A tall tree with a spreading canopy that releases clouds of luminous spores at dusk.',
  'The spores are timed in waves across a whole forest, synchronised by pulses in the roots. A shared biological clock.', 'Sap condenses into a bio-gel useful for sealants and medical compounds.');
flora('lantern_fern', 'Lantern Fern', 'vesper', 'A broad-leaved fern with soft internal light.',
  'Fronds track the light of nearby bulbs, turning to catch it. The fern feeds on glow-cycle chemistry rather than just sunlight.', 'Frond extract stabilises nutrient solutions. Useful for research.');
flora('glow_bulb', 'Glow Bulb', 'vesper', 'A fleshy bulb on a thin stalk that pulses with cyan or magenta light.',
  'Bulbs pulse in synchrony with their neighbours. Entire hillsides light up in slow, wave-like pulses.', 'Light-emitting cells are cold and efficient. A potential power source for lamps.');
flora('frost_spike', 'Frost Spike', 'nivalis', 'Upright crystalline growths that resemble ice but are living tissue.',
  'The "crystal" is a protein lattice that mimics ice, deflecting grazers while the plant photosynthesises inside.', 'The lattice is stable at extreme cold; a good insulation base.');
flora('cryo_lichen', 'Cryo Lichen', 'nivalis', 'Violet-blue patches spread flat across ice and rock.',
  'It metabolises at −60°C, powered by trace meltwater and sunlight scattered through the ice.', 'Cell membranes remain flexible at extreme cold. Useful for cold-resistant seals.');
flora('hoar_shrub', 'Hoar Shrub', 'nivalis', 'Skeletal white shrubs coated in rime ice.',
  'The rime is deposited deliberately: water vapour freezes on specialised hairs, giving the shrub a water supply in a desert of ice.', 'Fibres insulate well.');
flora('wave_palm', 'Wave Palm', 'pelagos', 'A curving palm-like plant, fronds splayed in the sea wind.',
  'It bends away from the prevailing wind and its roots anchor in coral rubble. It can survive full submersion during storm surge.', 'The fronds have a waterproof coating that sheds saltwater.');
flora('kelp', 'Ribbon Kelp', 'pelagos', 'Giant ribbons of kelp rising from the seabed toward the light.',
  'Air bladders along each stalk keep fronds upright. The forest shelters whole ecosystems.', 'Kelp extract is a good thickener and a source of deuterium-rich compounds.');
flora('coral_fan', 'Fan Coral', 'pelagos', 'Delicate fan-shaped coral in violet, orange and white.',
  'Fans orient perpendicular to the current to feed. Their orientation maps flow across the reef.', 'The calcium carbonate lattice is strong and light. Useful hull compounds.');

// ---------------------------------------------------------------- MINERALS
mineral('ferrolith', 'Ferrolith', 'khepri', 'A dense iron-rich ore in red-brown nodules.',
  'High iron content and trace nickel. Easily smelted and a staple for structural components.', 'Refined ferrolith unlocks improved extraction tool heads.');
mineral('silicate_glass', 'Silicate Glass', 'khepri', 'Clear, hard glassy mineral fused by ancient lightning and heat.',
  'Naturally annealed; it holds shape and clarity at extreme temperature swings.', 'Fused silicate sheets make excellent thermal insulation for suit layers.');
mineral('echolite', 'Echolite', 'khepri', 'Violet crystalline mineral that hums faintly when struck, and responds to nearby vibrations.',
  'A piezoelectric crystal that rings at a precise, stable tone. Ancient structures contain it as a structural part.', 'Echolite resonates in tune with an unknown base frequency. Its structure matches the Anthelion machinery.');
mineral('biogel', 'Bio-gel', 'vesper', 'A translucent, tacky resin tapped from Vesper\'s plants.',
  'Self-sealing under pressure; the gel hardens when exposed to air and softens when warmed.', 'A refined bio-gel allows better filtering of airborne toxins in the suit.');
mineral('cryo_salt', 'Cryo-salt', 'nivalis', 'Pale blue salts that remain liquid at far below freezing.',
  'A natural antifreeze; these salts transfer heat unusually well. A good coolant or heat-sink base.', 'Cryo-salt brines raise thermal tolerance for suit systems.');
mineral('deuterium_ice', 'Deuterium Ice', 'nivalis', 'Heavy-water ice, locked in glacial layers.',
  'A rich fusion fuel, extracted from ice or seawater.', 'Refined to drive-ready fuel.');
mineral('aqua_pearl', 'Aqua Pearl', 'pelagos', 'Iridescent pearls grown by deep-water molluscs.',
  'Dense layered carbonate with extreme compressive strength.', 'Aqua pearl lattice is the basis for pressure-resistant suit shells.');
mineral('relic_alloy', 'Relic Alloy', 'khepri', 'Grey-violet alloy of unfamiliar composition, salvaged from ancient structures.',
  'Corrosion-proof and very light. Inlaid with a lattice of echolite that no known smelting process could produce.', 'The alloy\'s structure rings when struck. Precisely the way echolite does.');

// ---------------------------------------------------------------- GEOLOGY
geo('layered_canyon', 'Layered Canyon Strata', 'khepri', 'Cliff faces show hundreds of distinct bands of sediment, each laid down in a different era.',
  'The bands record an ancient river delta. Khepri once held surface water, long before the atmosphere thinned.');
geo('fulgurite_field', 'Fulgurite Field', 'khepri', 'A field of glassy, branching spikes fused from sand by lightning.',
  'The scale of the fusion suggests a prolonged electrical storm, or something that carried far more energy than lightning.');
geo('karst_sinkhole', 'Karst Sinkhole', 'vesper', 'A circular collapse revealing a cave system beneath the jungle floor.',
  'The hole is lined with glowing moss that feeds on groundwater minerals. The cave system runs for kilometres.');
geo('ice_cave', 'Glacial Ice Cave', 'nivalis', 'A cathedral of blue ice carved by meltwater below the glacier.',
  'Trapped bubbles and dust layers record centuries. Echolite dust appears in layers, deposited by something that stopped long ago.');
geo('pressure_ridge', 'Pressure Ridge', 'nivalis', 'A jagged wall of buckled ice thrust upward by glacial compression.',
  'Fractures show that the ridge is still shifting, and has been for a long time. Structures beneath are being squeezed.');
geo('seamount', 'Seamount', 'pelagos', 'A drowned volcano rising from the ocean floor to just below the waves.',
  'Rich in minerals, it feeds a dense reef. Its summit shows signs of a much older, regular structure beneath.');
geo('hydrothermal_vent', 'Hydrothermal Vent', 'pelagos', 'A chimney of mineral deposits venting hot, dark water into the deep.',
  'Life clusters around the vent: tube worms, pale crabs, bacterial mats. A self-contained ecosystem fed by heat rather than light.');
for (const [p, n, a, b] of [
  ['khepri', 'Khepri', 'Marine fossils: shells of creatures that lived in a shallow sea.', 'Fossil growth rings record a day length of 31 hours: Khepri\'s rotation has slowed over millions of years.'],
  ['vesper', 'Vesper', 'Fossilised bones of a large, many-legged animal, preserved in amber-like resin.', 'The creature predates every known species here by millions of years, but wears the same luminous markings.'],
  ['nivalis', 'Nivalis', 'A frozen leaf-shaped fossil in the ice, a plant larger than anything living here today.', 'Nivalis was once temperate. The plant carries traces of echolite in its tissue.'],
  ['pelagos', 'Pelagos', 'A spiral shell fossil half a metre across, set in seabed limestone.', 'Isotope ratios suggest the shell\'s owner lived in far warmer, shallower seas.'],
]) geo('fossil_' + p, `${n} Fossil Bed`, p, a, b);

// ---------------------------------------------------------------- STRUCTURES
const structure = (id, name, planet, ident, arch, inscr, mach, extra = {}) => add({
  id, cat: 'structures', name, planet, ...extra,
  facts: [
    sc('id', 1, ident),
    ...(arch ? [sc('arch', 1, arch)] : []),
    ...(inscr ? [sc('inscr', 2, inscr.text, { lex: inscr.lex, w: !!inscr.w })] : []),
    ...(mach ? [sc('mach', 2, mach.text, { lex: mach.lex })] : []),
  ],
});
structure('khepri_pylon', 'Observatory Pylon', 'khepri',
  'A tall, tapering spire of violet-grey alloy standing alone on a plateau. No tool marks, no seams. It hums.',
  'Three slender arcs rise from a triangular base, joined at a ring near the top. The geometry is exact to the millimetre. (Pattern: TRIAD)',
  { text: 'The inscription band repeats a single glyph cluster. The name of its builders: Anthelion, "those who listen".', lex: 0, w: true },
  { text: 'A ring of echolite crystals around the spire\'s core vibrates in a fixed tone. Whatever this was built to listen for, it still listens.', lex: 1 });
structure('kestrel_station', 'Survey Station Kestrel-7', 'khepri',
  'A small, abandoned human survey station: three habitat modules, a landing pad and a battered antenna mast.', null, null, null);
structure('echo_cavern', 'Echo Cavern', 'khepri',
  'A cavern in the canyon wall, its roof lined with violet crystals that ring softly when the wind passes.',
  null, null, { text: 'The cavern is a resonant chamber, shaped by hand and designed so wind produces the same three-tone sequence.', lex: 1 });
structure('marigold_wreck', 'Crashed Lander Marigold', 'khepri',
  'A human survey lander, nose-down in the sand. Scorch marks suggest a hard landing; the crew are not aboard.', null, null, null);
structure('vesper_spire', 'Overgrown Spire', 'vesper',
  'A spire of grey-violet alloy, mostly swallowed by roots and moss. Spore trees have grown around it for centuries.',
  'Three arcs joined at a ring, buried but unmistakable. The same pattern as on Khepri. (Pattern: TRIAD)',
  { text: 'The inscription mentions a second word: a glyph for "echo", positioned beside the Anthelion name.', lex: 1, w: true },
  { text: 'The spire\'s echolite core is dormant but the roots of nearby trees are wrapped around it. They seem to be drinking its resonance.', lex: 2 });
structure('nivalis_arch', 'Buried Triad Arch', 'nivalis',
  'A great arch of alloy, three spans joined at the apex, half-buried in glacial ice and humming with a pulsing signal.',
  'The three-arc geometry again, vastly larger. It is the source of the repeating signal. (Pattern: TRIAD)',
  { text: 'The inscription reads, in the glyphs you have recovered: "WE LISTEN. WE ARE HEARD. WE REMAIN."', lex: 2, w: true },
  { text: 'The arch acts as a transmitter. The signal points down into the glacier, where a much larger structure is buried.', lex: 3 });
structure('nivalis_vault', 'Deep Vault', 'nivalis',
  'A huge sealed door set in a bowl of ice. Three sockets are arranged in a triangle on its face. It has no handle.',
  'The door opens only to a triple key: pattern, tone and resonance. The sockets match the Triad geometry.',
  null, { text: 'Behind the door, a chamber hums at the same frequency as every structure you have found.', lex: 0 },
  { door: true });
structure('pelagos_concord', 'Drowned Concord', 'pelagos',
  'A ring of tall columns on the seabed, fifty metres down, encircling a domed hall. Alloy, glowing faintly.',
  'The ring is laid out as three arcs, a Triad pattern drawn flat across the seabed. (Pattern: TRIAD)',
  { text: 'Inscriptions describe a gathering of "voices" in the water, and name a creature as a "chorister of the deep". The leviathan.', lex: 3, w: true },
  { text: 'The dome contains an echolite array angled toward the trench. It was built to listen for something in the deep.', lex: 3 });
structure('calloway_wreck', 'Derelict RV Calloway', 'space',
  'A drifting human research vessel, hull breached, in the shadow of an asteroid field.', null, null, null);
structure('orbital_ring', 'Anthelion Orbital Ring', 'space',
  'A great ring of alloy rotating slowly above Nivalis. Nothing about it is human.',
  'A single closed loop of three arcs. The Triad geometry, scaled to orbit. (Pattern: TRIAD)',
  { text: 'Its inscription is an astronomical chart. Every marked star lies on the same bearing: toward a point far beyond the region.', lex: 3, w: true }, null);
structure('tessera_market', 'Tessera Market', 'space',
  'A modular trading station, lit with warm amber, home to the Orrin.', null, null, null);
add({ id: 'resonance_node', cat: 'structures', name: 'Resonance Node', planet: 'khepri',
  facts: [sc('id', 2, 'A machine at the pylon\'s base. A core of echolite, crystalline conduits: a receiver and an emitter.', { lex: 1 })] });

// ---------------------------------------------------------------- CIVILISATIONS
add({ id: 'anthelion', cat: 'civs', name: 'The Anthelion', planet: 'all', facts: [
  { k: 'first', how: 'link', text: 'A civilisation that left its structures across the region. They built to listen.' },
  { k: 'tech', how: 'link', text: 'Their technology fused living tissue with echolite resonance: structures, machines and organisms tuned to one tone.' },
  { k: 'fate', how: 'link', text: 'The Anthelion did not die out. They sang themselves into the biospheres of the worlds they inhabited, and wait.' },
] });
add({ id: 'orrin', cat: 'civs', name: 'The Orrin', planet: 'space', facts: [
  { k: 'first', how: 'link', text: 'Nomadic traders who travel in modular stations. They communicate by modulating light and tone.' },
  { k: 'culture', how: 'link', text: 'The Orrin trade knowledge above all. A fact shared freely is a bond; a fact hoarded is an insult.' },
] });
add({ id: 'kharn', cat: 'civs', name: 'The Kharn Reclaimers', planet: 'space', facts: [
  { k: 'first', how: 'link', text: 'Salvagers who claim derelicts and strip them. Armed, territorial, unwilling to share.' },
  { k: 'culture', how: 'link', text: 'They hail once, then fire. Reclaimers consider every wreck in the region theirs by right.' },
] });

// ---------------------------------------------------------------- ANOMALIES
add({ id: 'harmonic_hum', cat: 'anomalies', name: 'Harmonic Hum', planet: 'khepri', facts: [
  sc('id', 1, 'A low-frequency vibration felt through the ground, stable in pitch, centred on the crystal caverns and the Pylon.'),
  sc('deep', 2, 'The hum is composed of three overlaid tones with simple ratios. The ratios are exact: not natural.'),
] });
add({ id: 'chorus_light', cat: 'anomalies', name: 'Chorus Light', planet: 'vesper', facts: [
  sc('id', 1, 'Every dusk, the grove lights up in a slow synchronised pulse, bulbs, ferns and birds in time.'),
  sc('deep', 2, 'The pulse is not driven by the sun. It runs on its own clock and has done so, in perfect time, for centuries.'),
] });
add({ id: 'echo_signal', cat: 'anomalies', name: 'The Echo Signal', planet: 'nivalis', facts: [
  sc('id', 1, 'A narrow-band signal repeating every 41 seconds from beneath Nivalis\'s ice.'),
  sc('deep', 2, 'The signal is a three-tone sequence, the same as the Lumen Choir\'s song and the Hum. It has been repeating for thousands of years.'),
] });
add({ id: 'aurora_static', cat: 'anomalies', name: 'Aurora Static', planet: 'nivalis', facts: [
  sc('id', 1, 'Curtains of blue light dancing low above the ice, with a prickling static charge underfoot.'),
  sc('deep', 2, 'The charge is a leakage from the buried transmitter, ionising the air in a ring. Energy readings are off the scale.'),
] });
add({ id: 'ion_nebula', cat: 'anomalies', name: 'Cradle Nebula', planet: 'space', facts: [
  sc('id', 1, 'A drifting cloud of ionised gas, the colour of bruises. Instruments flicker as you approach.'),
  sc('deep', 2, 'The cloud is the remains of a star that died a very long time ago. It has been shaped, subtly, into rings.'),
] });

// ---------------------------------------------------------------- HISTORY (logs, fragments)
const log = (id, name, planet, text) => add({ id, cat: 'history', name, planet, facts: [{ k: 'log', how: 'log', text }] });
log('kestrel_log_1', 'Kestrel-7 Log: Arrival', 'khepri', 'Day 4. Survey is routine: canyon geology, dust sampling. Strange: every instrument in the east array picks up the same low tone. Dr. Ama thinks it is interference from the cavern. It is not.');
log('kestrel_log_2', 'Kestrel-7 Log: The Pylon', 'khepri', 'Day 19. We found it: a spire on the plateau, no tool marks. Ama calls it a pylon. It is warm to the touch. Whatever it is, it was built, not grown. Nothing in our records matches.');
log('kestrel_log_3', 'Kestrel-7 Log: Last Entry', 'khepri', 'Day 31. We stopped hearing it, and that is what frightens me. It stopped when we stopped talking. Ama walked out at night. I am following. If someone finds this: the tone is not a signal. It is an invitation.');
log('marigold_log', 'Lander Marigold Flight Recorder', 'khepri', 'Pilot: "Engine failure at 800 metres. The hum is in the cockpit. I am setting down by the cavern. If there is anyone, please tell my sister I heard it too."');
log('calloway_log_1', 'RV Calloway Log: Rendezvous', 'space', 'Captain\'s log. We have mapped a ring structure above Nivalis. Not ours, not Orrin, not Kharn. The Kharn scouts are circling. We are running dark.');
log('calloway_log_2', 'RV Calloway Log: Breach', 'space', 'Reclaimer fire took the aft hold. We are bleeding air. Data core is safe. If you read this, the ring points to Nivalis. Dig below the arch.');
for (const [n, p, t] of [
  [1, 'khepri', 'A clay-like tablet wrapped in alloy, inscribed with the glyph for LISTEN.'],
  [2, 'vesper', 'A sphere of root-wrapped alloy, its glyphs showing ECHO beside the Anthelion name.'],
  [3, 'nivalis', 'A frozen alloy plate, inscribed with a spiral of three arcs and the glyph for REMAIN.'],
  [4, 'pelagos', 'A pearl-encrusted disc from the Concord, inscribed with the glyph for VOICE.'],
]) add({ id: 'frag_' + n, cat: 'history', name: `Anthelion Fragment ${['I', 'II', 'III', 'IV'][n - 1]}`, planet: p,
  facts: [{ k: 'dig', how: 'dig', w: true, text: t + ' Another word of their language is yours.' }] });

// ---------------------------------------------------------------- Final revelation (Echo Core)
add({ id: 'echo_core', cat: 'structures', name: 'The Echo Core', planet: 'nivalis', facts: [
  { k: 'first', how: 'core', text: 'A chamber of living crystal. At its heart, an echolite sphere holds a perfect, patient tone.' },
  { k: 'truth', how: 'core', text: 'The Anthelion did not vanish. They poured themselves into the resonance: biospheres on every world they touched now carry their song: the Choir, the Hum, the Chorus Light.' },
  { k: 'ask', how: 'core', text: 'The Core finishes its message and begins to repeat it: a bearing out of the region. A door beyond the ring. They are not gone. They are waiting to be heard back.' },
] });

export const ENTRY_LIST = Object.values(ENTRIES);

export function entryHowText(f) {
  switch (f.how) {
    case 'scan': return `Scan with scanner tier ${f.tier || 1}${f.lex ? `, Anthelion lexicon ≥ ${f.lex}` : ''}`;
    case 'obs': return `Observe the species ${f.b || 'behaviour'}`;
    case 'lab': return 'Collect a sample and analyse it at a research station or in your ship';
    case 'log': return 'Read the recorded log';
    case 'dig': return 'Excavate at a dig site (excavator required)';
    case 'orbit': return 'Scan the planet from orbit';
    case 'land': return 'Land on the surface';
    case 'core': return 'Reach the Echo Core';
    default: return 'Connect related discoveries';
  }
}
