# ECHOES OF THE UNKNOWN

A first-person sci-fi exploration/survival game for the browser, built from the GDD. Three.js (r170, loaded from CDN), ES modules, no build step, no assets (all geometry, textures and audio are procedural).

## Run
ES modules and the import map need http, so serve the folder:

    cd echoes && python3 -m http.server 8000
    # open http://localhost:8000

Internet is required for three.js from jsDelivr. To go offline, download `three.module.js` into the project and edit the import map in `index.html`.

## Controls
- Mouse look (click to capture), WASD move, Shift sprint, Space jump / jetpack, E interact
- On foot: 1 scanner (hold LMB), 2 mining laser, 3 terrain tool, B build outposts
- J journal, M map, I equipment, R research, T trade, Esc pause
- Ship: Tab board/exit; W/S/A/D thrust, Space/Ctrl up/down, Q/E roll, Shift boost, Z flight assist, V cruise drive

## Structure
- `src/game.js` orchestration, modes (surface/space), transitions, save
- `src/world/` planets, terrain streaming, flora, sky/weather, structures, space
- `src/entities/` player, ship, creatures
- `src/systems/` scanner, journal, survival, inventory, outposts, audio
- `src/data/` planets, species, codex, lore, upgrades (data-driven content)
- `src/core/` noise, input, events, save (localStorage behind a backend interface, cloud-ready)
- `tests/` headless smoke test: `npm test`

## Verification caveat
Built in a sandbox without network or a GPU browser. Game logic is covered by a headless smoke test (boot, all four planets, scanning, journal links, mining, survival, takeoff/landing, vault, ending, save/load, death) run against a three.js stub. **Real rendering has not been viewed in a browser**, so expect some visual tuning or Three.js API fixes on first run. Errors show in an on-screen overlay and the console.
