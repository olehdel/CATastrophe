import { GameState } from "./GameState.js";

const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space", "KeyE"]);

export class Input {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.pressed = new Set();
    this.pressedThisFrame = new Set();
    this.suppressedUntilRelease = new Set();
    this.virtualPointers = new Map();
    this.virtualMovement = { x: 0, y: 0 };
    document.addEventListener("keydown", (event) => this.handleKeyDown(event));
    document.addEventListener("keyup", (event) => {
      this.pressed.delete(event.code);
      this.suppressedUntilRelease.delete(event.code);
    });
    window.addEventListener("blur", () => this.clear());
  }

  handleKeyDown(event) {
    if (!MOVEMENT_KEYS.has(event.code) || this.stateManager.current !== GameState.PLAYING) return;
    if (event.code === "Space") event.preventDefault();
    if (!event.repeat) this.pressedThisFrame.add(event.code);
    this.pressed.add(event.code);
  }

  isDown(code) {
    return (this.pressed.has(code) || this.hasVirtualKey(code)) && !this.suppressedUntilRelease.has(code);
  }

  hasVirtualKey(code) {
    for (const activeCode of this.virtualPointers.values()) {
      if (activeCode === code) return true;
    }
    return false;
  }

  pressVirtualKey(code, pointerId) {
    if (!MOVEMENT_KEYS.has(code)) return;
    // A second pointerdown for the same pointer must not re-arm the key or
    // create duplicate entries that survive the matching pointerup.
    if (this.virtualPointers.has(pointerId)) return;
    const alreadyDown = this.isDown(code);
    this.virtualPointers.set(pointerId, code);
    if (!alreadyDown) this.pressedThisFrame.add(code);
  }

  releaseVirtualKey(pointerId) {
    const code = this.virtualPointers.get(pointerId);
    if (!code) return;
    this.virtualPointers.delete(pointerId);
    if (!this.pressed.has(code) && !this.hasVirtualKey(code)) {
      this.suppressedUntilRelease.delete(code);
    }
  }

  setVirtualMovement(x, y) {
    const magnitude = Math.hypot(x, y);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    this.virtualMovement.x = x * scale;
    this.virtualMovement.y = y * scale;
  }

  // Releases every touch-held key and clears the joystick vector without
  // touching physical keyboard state. Used on pause, blur, orientation change
  // and when Mobile Mode is switched off mid-run.
  clearVirtual() {
    this.virtualPointers.clear();
    this.virtualMovement.x = 0;
    this.virtualMovement.y = 0;
  }

  consumePress(code) {
    if (!this.pressedThisFrame.has(code)) return false;
    this.pressedThisFrame.delete(code);
    return true;
  }

  suppressUntilRelease(code) {
    this.suppressedUntilRelease.add(code);
  }

  getMovement() {
    return {
      x: Number(this.isDown("KeyD")) - Number(this.isDown("KeyA")) + this.virtualMovement.x,
      y: Number(this.isDown("KeyS")) - Number(this.isDown("KeyW")) + this.virtualMovement.y,
    };
  }

  clear() {
    this.pressed.clear();
    this.pressedThisFrame.clear();
    this.suppressedUntilRelease.clear();
    this.clearVirtual();
  }
}
