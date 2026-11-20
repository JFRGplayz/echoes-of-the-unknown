// Keyboard / mouse / pointer-lock input with per-frame "pressed" edges.
export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressedSet = new Set();
    this.mousePressed = new Set();
    this.mouse = { dx: 0, dy: 0, buttons: 0, wheel: 0 };
    this.locked = false;
    this.onLockChange = null;
    const block = new Set(['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F3']);

    addEventListener('keydown', (e) => {
      if (block.has(e.code) && this.locked) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedSet.add(e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse.buttons = 0; });
    el.addEventListener('mousedown', (e) => { this.mouse.buttons |= 1 << e.button; this.mousePressed.add(e.button); });
    addEventListener('mouseup', (e) => { this.mouse.buttons &= ~(1 << e.button); });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      this.onLockChange?.(this.locked);
    });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedSet.has(code); }
  mouseDown(b = 0) { return (this.mouse.buttons & (1 << b)) !== 0; }
  mouseClicked(b = 0) { return this.mousePressed.has(b); }
  lock() {
    if (document.pointerLockElement === this.el) return;
  
    try {
      const result = this.el.requestPointerLock?.();
      result?.catch?.(() => {
        // Pointer lock was refused. Wait for another user interaction.
      });
    } catch (e) {
      // Ignore synchronous pointer-lock errors too.
    }
  }
  unlock() { try { document.exitPointerLock?.(); } catch (e) { /* ignored */ } }
  endFrame() {
    this.pressedSet.clear(); this.mousePressed.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
  }
}
