// Save layer. Local storage today; swap `Save.backend` for a cloud backend later
// (any object with async read()/write(data)/clear()/exists()).
const KEY = 'echoes_unknown_save_v1';

export class LocalBackend {
  async exists() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
  async read() { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } }
  async write(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; } }
  async clear() { try { localStorage.removeItem(KEY); } catch { /* ignored */ } }
}

export const Save = {
  backend: new LocalBackend(),
  version: 1,
  exists() { return this.backend.exists(); },
  async load() {
    const d = await this.backend.read();
    if (!d || d.version !== this.version) return null;
    return d;
  },
  async write(data) { return this.backend.write({ ...data, version: this.version, savedAt: Date.now() }); },
  clear() { return this.backend.clear(); },
};

const SKEY = 'echoes_unknown_settings_v1';
const DEFAULTS = { quality: 'medium', volume: 0.8, music: 0.5, sensitivity: 1, invertY: false, fov: 75 };
export const Settings = {
  values: { ...DEFAULTS },
  load() { try { Object.assign(this.values, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch { /* ignored */ } return this.values; },
  save() { try { localStorage.setItem(SKEY, JSON.stringify(this.values)); } catch { /* ignored */ } },
};

export const QUALITY = {
  low:    { pixelRatio: 1,   shadow: false, shadowRes: 1024, bloom: false, flora: 0.35, creatures: 18, farTerrain: false },
  medium: { pixelRatio: 1.25, shadow: true,  shadowRes: 1024, bloom: true,  flora: 0.7,  creatures: 30, farTerrain: true },
  high:   { pixelRatio: 2,   shadow: true,  shadowRes: 2048, bloom: true,  flora: 1,    creatures: 44, farTerrain: true },
};
