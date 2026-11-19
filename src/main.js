import { Game } from './game.js';
import { Save } from './core/save.js';

const canvas = document.getElementById('game');
const fatal = (e) => {
  const f = document.getElementById('fatal');
  f.classList.remove('hidden'); f.textContent = 'Echoes of the Unknown failed to start:\n\n' + (e && e.stack ? e.stack : e);
};
addEventListener('error', (e) => fatal(e.error || e.message));
addEventListener('unhandledrejection', (e) => fatal(e.reason));

try {
  const game = new Game(canvas);
  window.__game = game; // handy for debugging in the console
  game.setMenu();
} catch (e) { fatal(e); }
