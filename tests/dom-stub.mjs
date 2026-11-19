// Minimal DOM/WebGL-ish globals so the game's UI and boot code run under Node.
const mk = () => {
  const store = { width: 300, height: 150, children: [], dataset: {}, style: {}, textContent: '', innerHTML: '', value: '' };
  const classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  const ctx = new Proxy({}, { get(t, p) {
    if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
    if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
    if (p === 'measureText') return () => ({ width: 10 });
    return p in t ? t[p] : () => {}; }, set(t, p, v) { t[p] = v; return true; } });
  const el = new Proxy(store, { get(t, p) {
    if (p === 'classList') return classList; if (p === 'nodeType') return 1; if (p === 'getContext') return () => ctx;
    if (p === 'firstChild') return { remove() {} }; if (p === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: 980, height: 560 });
    if (p in t) return t[p]; return (...a) => el; }, set(t, p, v) { t[p] = v; return true; } });
  return el;
};
const listeners = {};
globalThis.document = { getElementById: () => mk(), createElement: () => mk(), createTextNode: (s) => ({ nodeType: 3, s }), addEventListener() {}, pointerLockElement: null, exitPointerLock() {}, body: mk() };
globalThis.window = globalThis;
globalThis.addEventListener = (n, f) => { (listeners[n] ||= []).push(f); };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = () => 0;
const ls = new Map();
globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
globalThis.__mkEl = mk;
