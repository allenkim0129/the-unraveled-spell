export type InputAction = 'sight' | 'interact' | 'execute' | 'undo' | 'reset' | 'help';

const bindings: Record<string, InputAction> = {
  KeyE: 'sight',
  KeyF: 'interact',
  Space: 'execute',
  KeyZ: 'undo',
  KeyR: 'reset',
  KeyH: 'help',
};
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);

export class GameInput {
  private keys = new Set<string>();
  private stickPointer: number | null = null;
  private cameraPointer: number | null = null;
  private stickX = 0;
  private stickY = 0;
  private cameraX = 0;
  private cameraY = 0;
  private orbitX = 0;
  private orbitY = 0;
  private listeners = new AbortController();

  constructor(
    canvas: HTMLCanvasElement,
    stick: HTMLElement,
    knob: HTMLElement,
    onAction: (action: InputAction) => void,
  ) {
    const options = { signal: this.listeners.signal };
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.matches('input, textarea, select') ||
        target.isContentEditable ||
        (target.closest('button') && (event.code === 'Space' || event.code === 'Enter'))
      )) return;
      if (movementKeys.has(event.code)) {
        event.preventDefault();
        this.keys.add(event.code);
      }
      const action = bindings[event.code];
      if (action && !event.repeat) {
        event.preventDefault();
        onAction(action);
      }
    }, options);
    window.addEventListener('keyup', (event) => this.keys.delete(event.code), options);

    const updateStick = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const radius = rect.width * 0.33;
      const x = (event.clientX - rect.left - rect.width / 2) / radius;
      const y = (event.clientY - rect.top - rect.height / 2) / radius;
      const length = Math.max(1, Math.hypot(x, y));
      this.stickX = x / length;
      this.stickY = -y / length;
      knob.style.transform = `translate(${this.stickX * radius}px, ${-this.stickY * radius}px)`;
    };
    stick.addEventListener('pointerdown', (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event);
    }, options);
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.stickPointer) updateStick(event);
    }, options);
    const releaseStick = (event: PointerEvent) => {
      if (event.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.stickX = this.stickY = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerup', releaseStick, options);
    stick.addEventListener('pointercancel', releaseStick, options);
    stick.addEventListener('lostpointercapture', releaseStick, options);

    canvas.addEventListener('pointerdown', (event) => {
      if (this.cameraPointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      this.cameraPointer = event.pointerId;
      this.cameraX = event.clientX;
      this.cameraY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }, options);
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.cameraPointer) return;
      this.orbitX += (event.clientX - this.cameraX) * 0.006;
      this.orbitY += (event.clientY - this.cameraY) * 0.004;
      this.cameraX = event.clientX;
      this.cameraY = event.clientY;
    }, options);
    const releaseCamera = (event: PointerEvent) => {
      if (event.pointerId === this.cameraPointer) this.cameraPointer = null;
    };
    canvas.addEventListener('pointerup', releaseCamera, options);
    canvas.addEventListener('pointercancel', releaseCamera, options);
    canvas.addEventListener('lostpointercapture', releaseCamera, options);
    window.addEventListener('blur', () => this.clear(knob), options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear(knob);
    }, options);
  }

  axes(): { x: number; y: number } {
    let x = this.stickX + Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    let y = this.stickY + Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    return { x, y };
  }

  orbit(): { x: number; y: number } {
    const result = { x: this.orbitX, y: this.orbitY };
    this.orbitX = this.orbitY = 0;
    return result;
  }

  clear(knob: HTMLElement): void {
    this.keys.clear();
    this.stickPointer = this.cameraPointer = null;
    this.stickX = this.stickY = this.orbitX = this.orbitY = 0;
    knob.style.transform = '';
  }

  dispose(): void {
    this.listeners.abort();
  }
}
