import { GameState } from "../core/GameState.js";
import { formatRunTime } from "../systems/GameTimer.js";
import { NO_RANK_LABEL } from "../systems/RunStats.js";

const SCREEN_BY_STATE = Object.freeze({
  [GameState.MAIN_MENU]: "main-menu",
  [GameState.PAUSED]: "paused-screen",
  [GameState.VICTORY]: "victory-screen",
  [GameState.GAME_OVER]: "game-over-screen",
});

const STATUS_BY_STATE = Object.freeze({
  [GameState.MAIN_MENU]: "Ready when you are.",
  [GameState.PLAYING]: "Explore with WASD. Shift sneaks; Space sprints.",
  [GameState.PAUSED]: "Game paused.",
  [GameState.VICTORY]: "Victory! A medal was earned.",
  [GameState.GAME_OVER]: "Run over.",
});

const MOBILE_MODE_STORAGE_KEY = "catastrophe.mobile-mode.v1";

const TUTORIAL_STEPS = Object.freeze([
  {
    action: "walk",
    title: "Move",
    body: "Take a few steps.",
    keys: ["W", "A", "S", "D"],
    touchLabel: "JOYSTICK",
    desktopHint: "Use W A S D",
    touchHint: "Drag the joystick",
  },
  {
    action: "sprint",
    title: "Sprint",
    body: "Hold to run faster.",
    keys: ["SPACE"],
    touchLabel: "SPRINT",
    desktopHint: "Hold SPACE",
    touchHint: "Hold the highlighted SPRINT",
  },
  {
    action: "sneak",
    title: "Sneak",
    body: "Hold to move quietly.",
    keys: ["SHIFT"],
    touchLabel: "SNEAK",
    desktopHint: "Hold SHIFT",
    touchHint: "Hold the highlighted SNEAK",
  },
  {
    action: "scratch",
    title: "Scratch",
    body: "Get close, then hold.",
    keys: ["E"],
    touchLabel: "ACTION",
    desktopHint: "Hold E by furniture",
    touchHint: "Hold ACTION by furniture",
  },
  {
    action: "mouse",
    title: "Catch a mouse",
    body: "Follow the marker and get close.",
    keys: ["E"],
    touchLabel: "ACTION",
    desktopHint: "Hold E near the mouse",
    touchHint: "Hold ACTION near the mouse",
  },
]);

export class GameUI {
  constructor(stateManager, game, movementHUD, audioManager = null) {
    this.stateManager = stateManager;
    this.game = game;
    this.movementHUD = movementHUD;
    this.audioManager = audioManager;
    this.screens = Object.values(SCREEN_BY_STATE).map((id) => document.getElementById(id));
    this.statusMessage = document.getElementById("status-message");
    this.pauseButton = document.getElementById("pause-button");
    this.runHUD = document.getElementById("run-hud");
    this.settingsOverlay = document.getElementById("settings-overlay");
    this.touchControls = document.getElementById("touch-controls");
    this.virtualJoystick = document.getElementById("virtual-joystick");
    this.joystickKnob = this.virtualJoystick?.querySelector(".virtual-joystick-knob");
    this.joystickPointerId = null;
    this.touchButtons = [...(this.touchControls?.querySelectorAll("[data-touch-key]") ?? [])];
    this.actionTouchButton = this.touchButtons.find((button) => button.dataset.touchKey === "KeyE");
    this.mobileModeToggle = document.getElementById("mobile-mode-toggle");
    this.mobileModeValue = document.getElementById("mobile-mode-value");
    this.mobileModeEnabled = false;
    this.tutorialOverlay = document.getElementById("tutorial-overlay");
    this.tutorialTitle = document.getElementById("tutorial-title");
    this.tutorialBody = document.getElementById("tutorial-body");
    this.tutorialControls = document.getElementById("tutorial-controls");
    this.tutorialProgress = document.getElementById("tutorial-progress");
    this.tutorialDots = document.getElementById("tutorial-dots");
    this.tutorialStepEl = document.getElementById("tutorial-step");
    this.tutorialIcon = document.getElementById("tutorial-icon");
    this.tutorialGuide = document.getElementById("tutorial-guide");
    this.tutorialGuideRing = document.getElementById("tutorial-guide-ring");
    this.tutorialGuideArrow = document.getElementById("tutorial-guide-arrow");
    this.tutorialActive = false;
    this.tutorialStepIndex = 0;
    this.tutorialActionTime = 0;
    this.tutorialAdvanceTimer = 0;
    this.tutorialCompletionTime = 0;
    this.game.onTutorialPracticeUpdate = (context) => this.updateTutorialPractice(context);
    this.game.onInteractionTargetsUpdate = (targets) => this.updateInteractionTargets(targets);
    this.settingsReturnState = null;
    this.settingsOpener = null;
    this.bindControls();
    this.bindTouchControls();
    this.syncAudioControls();
    this.applyMobileMode(this.loadMobileMode(), { persist: false });
    this.stateManager.subscribe((state) => this.renderState(state));
    this.renderState(this.stateManager.current);
  }

  bindControls() {
    document.getElementById("start-button").addEventListener("click", () => {
      this.startNewRun();
    });
    document.getElementById("resume-button").addEventListener("click", () => {
      this.stateManager.transition(GameState.PLAYING);
    });
    document.getElementById("main-menu-button").addEventListener("click", () => this.game.returnToMainMenu());
    this.pauseButton.addEventListener("click", () => this.pause());
    document.getElementById("main-menu-settings-button").addEventListener("click", (event) => this.openSettings(event));
    document.getElementById("paused-settings-button").addEventListener("click", (event) => this.openSettings(event));
    document.getElementById("close-settings-button").addEventListener("click", () => this.closeSettings());
    document.getElementById("mute-button").addEventListener("click", () => {
      this.audioManager?.toggleMute();
      this.syncMuteButton();
    });
    this.mobileModeToggle?.addEventListener("change", () => {
      this.applyMobileMode(this.mobileModeToggle.checked);
    });

    for (const [key, setting] of [["master-volume", "masterVolume"], ["music-volume", "musicVolume"], ["effects-volume", "effectsVolume"]]) {
      const slider = document.getElementById(key);
      slider.addEventListener("input", () => {
        const percentage = Number(slider.value);
        document.getElementById(`${key}-value`).textContent = `${percentage}%`;
        this.audioManager?.updateSettings({ [setting]: percentage / 100 });
      });
    }

    for (const id of ["paused-restart-button", "victory-restart-button", "game-over-restart-button", "third-capture-restart-button"]) {
      document.getElementById(id).addEventListener("click", () => this.startNewRun());
    }
    for (const id of ["victory-menu-button", "game-over-menu-button", "third-capture-menu-button"]) {
      document.getElementById(id).addEventListener("click", () => this.game.returnToMainMenu());
    }

    document.addEventListener("keydown", (event) => {
      if (event.code === "F3" || event.key === "F3") {
        event.preventDefault();
        if (event.repeat) return;
        this.movementHUD.toggleVisibility();
      } else if (event.key === "Escape" && !this.settingsOverlay.hidden) {
        event.preventDefault();
        this.closeSettings();
      } else if (event.key === "Escape" && this.stateManager.current === GameState.PLAYING) {
        event.preventDefault();
        this.pause();
      } else if (event.key === "Escape" && this.stateManager.current === GameState.PAUSED) {
        this.stateManager.transition(GameState.PLAYING);
      }
    });
  }

  bindTouchControls() {
    if (!this.touchControls || !this.virtualJoystick) return;

    const updateJoystick = (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      const bounds = this.virtualJoystick.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const maxRadius = Math.max(1, Math.min(bounds.width, bounds.height) * 0.36);
      const dx = event.clientX - centerX;
      const dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      const directionX = distance > 0 ? dx / distance : 0;
      const directionY = distance > 0 ? dy / distance : 0;
      // A radial dead zone stops small thumb jitter from producing movement,
      // then rescales the remaining travel so diagonals stay accurate and the
      // first few degrees of drag still respond smoothly.
      const deadZone = maxRadius * 0.16;
      const strength = distance <= deadZone
        ? 0
        : Math.min(1, (distance - deadZone) / (maxRadius - deadZone));
      this.game.input.setVirtualMovement(directionX * strength, directionY * strength);
      const knobDistance = Math.min(distance, maxRadius);
      this.joystickKnob.style.transform =
        `translate(calc(-50% + ${directionX * knobDistance}px), calc(-50% + ${directionY * knobDistance}px))`;
    };

    const releaseJoystick = (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.game.input.setVirtualMovement(0, 0);
      this.joystickKnob.style.transform = "translate(-50%, -50%)";
      if (this.virtualJoystick.hasPointerCapture?.(event.pointerId)) {
        this.virtualJoystick.releasePointerCapture(event.pointerId);
      }
    };

    this.virtualJoystick.addEventListener("pointerdown", (event) => {
      if (!this.mobileModeEnabled || this.stateManager.current !== GameState.PLAYING) return;
      if (this.joystickPointerId !== null) return;
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      this.virtualJoystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });
    this.virtualJoystick.addEventListener("pointermove", updateJoystick);
    this.virtualJoystick.addEventListener("pointerup", releaseJoystick);
    this.virtualJoystick.addEventListener("pointercancel", releaseJoystick);
    this.virtualJoystick.addEventListener("lostpointercapture", releaseJoystick);

    for (const button of this.touchButtons) {
      const code = button.dataset.touchKey;
      const release = (event) => {
        this.game.input.releaseVirtualKey(event.pointerId);
        if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
        if (!this.game.input.hasVirtualKey(code)) button.classList.remove("touch-button--pressed");
      };
      button.addEventListener("pointerdown", (event) => {
        if (!this.mobileModeEnabled || this.stateManager.current !== GameState.PLAYING) return;
        event.preventDefault();
        this.game.input.pressVirtualKey(code, event.pointerId);
        button.classList.add("touch-button--pressed");
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("lostpointercapture", release);
      // Long-press must not open the browser context menu over a held action.
      button.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    this.touchControls.addEventListener("contextmenu", (event) => event.preventDefault());
    this.virtualJoystick.addEventListener("contextmenu", (event) => event.preventDefault());

    // Browsers can cancel touch streams on blur, tab switches or rotation.
    // Clear every virtual input so the cat cannot keep moving or scratching.
    const resetTouchInput = () => this.clearTouchControls();
    window.addEventListener("blur", resetTouchInput);
    window.addEventListener("orientationchange", resetTouchInput);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) resetTouchInput();
    });
  }

  beginTutorial() {
    this.tutorialActive = true;
    this.tutorialStepIndex = 0;
    this.tutorialActionTime = 0;
    this.tutorialAdvanceTimer = 0;
    this.tutorialCompletionTime = 0;
    this.game.startTutorial();
    this.setTutorialStep(0);
  }

  startNewRun() {
    this.game.restart();
    this.game.cancelTutorial();
    this.tutorialActive = false;
    this.tutorialStepIndex = 0;
    this.tutorialActionTime = 0;
    this.tutorialAdvanceTimer = 0;
    this.tutorialCompletionTime = 0;
    this.tutorialOverlay.hidden = true;
    this.tutorialOverlay.classList.remove("tutorial-panel--done");
    this.hideTutorialGuide();
    this.beginTutorial();
  }

  setTutorialStep(index) {
    this.tutorialStepIndex = index;
    this.tutorialActionTime = 0;
    this.tutorialAdvanceTimer = 0;
    this.tutorialOverlay.classList.remove("tutorial-panel--done");
    const step = TUTORIAL_STEPS[index];
    this.game.setTutorialStep(step?.action ?? null);
    this.renderTutorialStep();
  }

  advanceTutorialStep() {
    const nextIndex = this.tutorialStepIndex + 1;
    if (nextIndex >= TUTORIAL_STEPS.length) this.completeTutorial();
    else this.setTutorialStep(nextIndex);
  }

  renderTutorialStep() {
    const shouldShow = this.tutorialActive
      && this.stateManager.current === GameState.PLAYING
      && this.settingsOverlay.hidden;
    if (!shouldShow) {
      this.tutorialOverlay.hidden = true;
      this.hideTutorialGuide();
      return;
    }
    const complete = this.tutorialStepIndex >= TUTORIAL_STEPS.length;
    const step = complete ? null : TUTORIAL_STEPS[this.tutorialStepIndex];
    this.tutorialOverlay.hidden = false;
    this.tutorialOverlay.classList.toggle("tutorial-panel--done", complete || this.tutorialAdvanceTimer > 0);
    this.tutorialProgress.textContent = complete
      ? "READY"
      : `STEP ${this.tutorialStepIndex + 1} / ${TUTORIAL_STEPS.length}`;
    this.tutorialTitle.textContent = complete ? "Nice work!" : step.title;
    this.tutorialBody.textContent = complete ? "Your run starts now." : step.body;
    const controls = complete ? "" : this.getTutorialControls(step);
    this.tutorialControls.textContent = controls;
    this.tutorialControls.hidden = !controls;
    this.renderTutorialDots();
    this.tutorialIcon.innerHTML = this.buildTutorialIcon(step);
    this.setTutorialHighlights(step?.action ?? null);
    this.tutorialStepEl.classList.remove("tutorial-step--enter");
    void this.tutorialStepEl.offsetWidth;
    this.tutorialStepEl.classList.add("tutorial-step--enter");
  }

  renderTutorialDots() {
    this.tutorialDots.innerHTML = TUTORIAL_STEPS.map((_, index) => {
      const state = index < this.tutorialStepIndex ? " tutorial-dot--done"
        : index === this.tutorialStepIndex ? " tutorial-dot--active"
          : "";
      return `<span class="tutorial-dot${state}"></span>`;
    }).join("");
  }

  buildTutorialIcon(step) {
    if (!step) return '<span class="tutorial-key tutorial-key--done">\u2713</span>';
    if (this.mobileModeEnabled) {
      return `<span class="tutorial-key tutorial-key--wide">${step.touchLabel}</span>`;
    }
    return step.keys.map((key, index) => {
      const wide = key.length > 1 ? " tutorial-key--wide" : "";
      return `<span class="tutorial-key${wide}" style="--i:${index}">${key}</span>`;
    }).join("");
  }

  getTutorialControls(step) {
    if (!step) return "";
    return this.mobileModeEnabled ? step.touchHint : step.desktopHint;
  }

  tutorialButtonFor(code) {
    return this.touchButtons.find((button) => button.dataset.touchKey === code) ?? null;
  }

  setTutorialHighlights(action) {
    this.clearTutorialHighlights();
    if (!this.tutorialActive || !action || this.stateManager.current !== GameState.PLAYING) return;
    if (!this.mobileModeEnabled) return;
    if (action === "walk") this.virtualJoystick?.classList.add("tutorial-highlight");
    else if (action === "sprint") this.tutorialButtonFor("Space")?.classList.add("tutorial-highlight");
    else if (action === "sneak") this.tutorialButtonFor("ShiftLeft")?.classList.add("tutorial-highlight");
    else this.actionTouchButton?.classList.add("tutorial-highlight");
  }

  clearTutorialHighlights() {
    this.virtualJoystick?.classList.remove("tutorial-highlight");
    for (const button of this.touchButtons) button.classList.remove("tutorial-highlight");
  }

  isTouchInputDevice() {
    const mediaQueries = ["(pointer: coarse)", "(any-pointer: coarse)", "(hover: none)", "(any-hover: none)"];
    const coarseOrNoHover = typeof window.matchMedia === "function"
      && mediaQueries.some((query) => window.matchMedia(query).matches);
    const touchPoints = Number(navigator.maxTouchPoints ?? navigator.msMaxTouchPoints ?? 0) > 0;
    const touchEvents = "ontouchstart" in window;
    const mobileAgent = Boolean(navigator.userAgentData?.mobile)
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? "");
    return coarseOrNoHover || touchPoints || touchEvents || mobileAgent;
  }

  completeTutorial() {
    if (!this.tutorialActive) return;
    this.tutorialStepIndex = TUTORIAL_STEPS.length;
    this.tutorialAdvanceTimer = 0;
    this.tutorialActionTime = 0;
    this.tutorialCompletionTime = 1.6;
    this.game.setTutorialStep(null);
    this.renderTutorialStep();
  }

  finishTutorial() {
    this.tutorialActive = false;
    this.tutorialCompletionTime = 0;
    this.tutorialAdvanceTimer = 0;
    this.tutorialOverlay.hidden = true;
    this.tutorialOverlay.classList.remove("tutorial-panel--done");
    this.clearTutorialHighlights();
    this.hideTutorialGuide();
    this.game.endTutorial();
  }

  markTutorialStepDone() {
    if (this.tutorialAdvanceTimer > 0) return;
    this.tutorialAdvanceTimer = 0.4;
    this.tutorialOverlay.classList.add("tutorial-panel--done");
  }

  updateTutorialPractice({ deltaSeconds, cat, furnitureSystem, mouseCaught }) {
    if (!this.tutorialActive) return;
    this.updateTutorialGuide(cat);
    if (this.tutorialStepIndex >= TUTORIAL_STEPS.length) {
      this.tutorialCompletionTime = Math.max(0, this.tutorialCompletionTime - deltaSeconds);
      if (this.tutorialCompletionTime === 0) this.finishTutorial();
      return;
    }
    if (this.tutorialAdvanceTimer > 0) {
      this.tutorialAdvanceTimer = Math.max(0, this.tutorialAdvanceTimer - deltaSeconds);
      if (this.tutorialAdvanceTimer === 0) this.advanceTutorialStep();
      return;
    }

    const action = TUTORIAL_STEPS[this.tutorialStepIndex].action;
    const actualSpeed = Math.hypot(cat.velocityX, cat.velocityY);
    const completed = action === "walk" ? actualSpeed > 0.1
      : action === "sprint" ? cat.mode === "sprint" && actualSpeed > 0.1
        : action === "sneak" ? cat.mode === "sneak" && actualSpeed > 0.1
          : action === "scratch" ? furnitureSystem.scratchHeld
            : action === "mouse" ? Boolean(mouseCaught)
              : false;
    this.tutorialActionTime = completed ? this.tutorialActionTime + deltaSeconds : 0;
    const requiredSeconds = action === "scratch" ? 0.4 : 0.25;
    if ((action === "mouse" && completed) || this.tutorialActionTime >= requiredSeconds) {
      this.markTutorialStepDone();
    }
  }

  updateTutorialGuide(cat) {
    const action = this.tutorialActive && this.tutorialStepIndex < TUTORIAL_STEPS.length
      ? TUTORIAL_STEPS[this.tutorialStepIndex].action
      : null;
    if (!action || (action !== "scratch" && action !== "mouse")
      || this.stateManager.current !== GameState.PLAYING || !this.settingsOverlay.hidden) {
      this.hideTutorialGuide();
      return;
    }
    const target = this.getTutorialTarget(action, cat);
    if (!target) {
      this.hideTutorialGuide();
      return;
    }
    const frame = this.tutorialGuide.parentElement;
    const frameRect = frame.getBoundingClientRect();
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const camera = this.game.camera;
    const rawX = (canvasRect.left - frameRect.left)
      + camera.viewportWidth / 2 + (target.x - camera.x) * camera.zoom;
    const rawY = (canvasRect.top - frameRect.top)
      + camera.viewportHeight / 2 + (target.y - camera.y) * camera.zoom;
    const margin = 40;
    const x = Math.max(margin, Math.min(frameRect.width - margin, rawX));
    const y = Math.max(margin, Math.min(frameRect.height - margin, rawY));
    const onScreen = x === rawX && y === rawY;
    this.tutorialGuide.hidden = false;
    this.tutorialGuide.style.left = `${x}px`;
    this.tutorialGuide.style.top = `${y}px`;
    this.tutorialGuideRing.hidden = !onScreen;
    this.tutorialGuideArrow.hidden = onScreen;
    if (!onScreen) {
      this.tutorialGuideArrow.style.transform = `rotate(${Math.atan2(rawY - y, rawX - x)}rad)`;
    }
  }

  getTutorialTarget(action, cat) {
    if (action === "mouse") {
      const mouse = this.game.mouseSystem.getTutorialMouse() ?? this.game.mouseSystem.catchableMouse;
      return mouse ? { x: mouse.x, y: mouse.y } : null;
    }
    const furnitureTarget = this.game.furnitureSystem.target;
    if (furnitureTarget?.point) return { ...furnitureTarget.point };
    let nearest = null;
    for (const item of this.game.house.furniture) {
      const state = this.game.furnitureSystem.getState(item.id);
      if (!state || state.completedStages >= 3) continue;
      const x = item.x + item.width / 2;
      const y = item.y + item.height / 2;
      const distance = Math.hypot(cat.x - x, cat.y - y);
      if (!nearest || distance < nearest.distance) nearest = { x, y, distance };
    }
    return nearest;
  }

  hideTutorialGuide() {
    if (this.tutorialGuide) this.tutorialGuide.hidden = true;
  }

  clearTouchControls() {
    this.joystickPointerId = null;
    this.game.input.clearVirtual();
    if (this.joystickKnob) this.joystickKnob.style.transform = "translate(-50%, -50%)";
    for (const button of this.touchButtons) button.classList.remove("touch-button--pressed");
    this.updateInteractionTargets({ mouseCatchable: false, furnitureTarget: false });
  }

  updateInteractionTargets({ mouseCatchable = false, furnitureTarget = false } = {}) {
    if (!this.actionTouchButton) return;
    const touchDevice = this.mobileModeEnabled;
    const showCatch = touchDevice && mouseCatchable;
    const showFurniture = touchDevice && !mouseCatchable && furnitureTarget;
    const available = showCatch || showFurniture;
    this.actionTouchButton.classList.toggle("touch-button--target", available);
    if (showCatch) this.actionTouchButton.setAttribute("aria-label", "ACTION: catch mouse");
    else if (showFurniture) this.actionTouchButton.setAttribute("aria-label", "ACTION: scratch furniture");
    else this.actionTouchButton.setAttribute("aria-label", "Hold to interact");
  }

  pause() {
    if (this.stateManager.current === GameState.PLAYING) {
      this.stateManager.transition(GameState.PAUSED);
    }
  }

  openSettings(event) {
    const state = this.stateManager.current;
    if (state !== GameState.MAIN_MENU && state !== GameState.PAUSED) return;
    this.settingsReturnState = state;
    this.settingsOpener = event.currentTarget;
    this.syncAudioControls();
    this.settingsOverlay.hidden = false;
    this.renderTutorialStep();
    document.getElementById("close-settings-button").focus();
  }

  closeSettings(restoreFocus = true) {
    if (this.settingsOverlay.hidden) return;
    this.settingsOverlay.hidden = true;
    this.renderTutorialStep();
    if (restoreFocus && this.settingsOpener?.isConnected) this.settingsOpener.focus();
    this.settingsOpener = null;
  }

  loadMobileMode() {
    try {
      const saved = window.localStorage.getItem(MOBILE_MODE_STORAGE_KEY);
      if (saved === "true") return true;
      if (saved === "false") return false;
    } catch {
      // Fall through to touch detection when storage is unavailable.
    }
    return this.isTouchInputDevice();
  }

  saveMobileMode(enabled) {
    try {
      window.localStorage.setItem(MOBILE_MODE_STORAGE_KEY, String(Boolean(enabled)));
    } catch {
      // Keep the current in-memory choice when storage is blocked.
    }
  }

  applyMobileMode(enabled, { persist = true } = {}) {
    this.mobileModeEnabled = Boolean(enabled);
    document.body.classList.toggle("mobile-mode", this.mobileModeEnabled);
    if (persist) this.saveMobileMode(this.mobileModeEnabled);
    if (!this.mobileModeEnabled) this.clearTouchControls();
    this.syncMobileModeControl();
    // Re-render the current tutorial step so labels and highlights switch
    // between keyboard and touch hints without restarting the run.
    this.renderTutorialStep();
  }

  syncMobileModeControl() {
    if (this.mobileModeToggle) {
      this.mobileModeToggle.checked = this.mobileModeEnabled;
      this.mobileModeToggle.setAttribute("aria-checked", String(this.mobileModeEnabled));
    }
    if (this.mobileModeValue) this.mobileModeValue.textContent = this.mobileModeEnabled ? "On" : "Off";
  }

  syncAudioControls() {
    const settings = this.audioManager?.settings;
    if (settings) {
      for (const [id, key] of [["master-volume", "masterVolume"], ["music-volume", "musicVolume"], ["effects-volume", "effectsVolume"]]) {
        const value = Math.round(settings[key] * 100);
        document.getElementById(id).value = String(value);
        document.getElementById(`${id}-value`).textContent = `${value}%`;
      }
      this.syncMuteButton();
    }
    this.syncMobileModeControl();
  }

  syncMuteButton() {
    const muted = Boolean(this.audioManager?.settings.muted);
    const button = document.getElementById("mute-button");
    button.textContent = muted ? "Unmute audio" : "Mute audio";
    button.setAttribute("aria-pressed", String(muted));
  }

  renderState(state) {
    if (state === GameState.MAIN_MENU) {
      this.tutorialActive = false;
      this.tutorialStepIndex = 0;
      this.tutorialActionTime = 0;
      this.tutorialAdvanceTimer = 0;
      this.tutorialCompletionTime = 0;
      this.tutorialOverlay.hidden = true;
      this.tutorialOverlay.classList.remove("tutorial-panel--done");
      this.clearTutorialHighlights();
      this.hideTutorialGuide();
      this.game.cancelTutorial();
    }
    if ((state === GameState.VICTORY || state === GameState.GAME_OVER) && this.tutorialActive) {
      this.tutorialActive = false;
      this.game.cancelTutorial();
    }
    if (state !== GameState.PLAYING) {
      this.hideTutorialGuide();
      this.clearTutorialHighlights();
    }
    this.touchControls.hidden = state !== GameState.PLAYING;
    document.body.classList.toggle("game-active", state === GameState.PLAYING);
    if (state !== GameState.PLAYING) this.clearTouchControls();
    if (!this.settingsOverlay.hidden && state !== this.settingsReturnState) this.closeSettings(false);
    if (state === GameState.MAIN_MENU || state === GameState.VICTORY || state === GameState.GAME_OVER) {
      this.movementHUD.updateCapturePresentation(null, this.game.captureSystem.lives);
    }
    for (const screen of this.screens) screen.hidden = true;
    const activeScreenId = SCREEN_BY_STATE[state];
    if (activeScreenId) document.getElementById(activeScreenId).hidden = false;
    this.pauseButton.hidden = state !== GameState.PLAYING;
    const endScreenActive = state === GameState.VICTORY || state === GameState.GAME_OVER;
    this.runHUD.hidden = state === GameState.MAIN_MENU || endScreenActive;
    this.movementHUD.setSuppressed(endScreenActive);
    this.renderTutorialStep();
    this.statusMessage.textContent = STATUS_BY_STATE[state];
    if (state === GameState.VICTORY || state === GameState.GAME_OVER) this.renderResults(this.game.results);
  }

  renderResults(results) {
    if (!results) return;
    const isVictory = this.stateManager.current === GameState.VICTORY;
    const activeScreenId = isVictory ? "victory-screen" : "game-over-screen";
    const activeScreen = document.getElementById(activeScreenId);
    const medalText = results.rank === NO_RANK_LABEL ? "No medal (Lost)" : `${results.rank} medal`;
    const medalTier = results.rank === NO_RANK_LABEL ? "lost" : String(results.rank).toLowerCase();

    if (isVictory) {
      const medal = document.getElementById("victory-medal");
      medal.textContent = medalText;
      medal.dataset.rankTier = medalTier;
      document.getElementById("victory-reason").textContent = results.reason === "all-furniture-destroyed"
        ? "You destroyed every piece of furniture — total chaos!"
        : "Time's up, but your destruction earned a medal!";
      this.statusMessage.textContent = `${results.rank} victory — medal earned.`;
    } else {
      const isThirdCapture = results.reason === "third-capture";
      document.getElementById("standard-game-over-content").hidden = isThirdCapture;
      document.getElementById("third-capture-results").hidden = !isThirdCapture;
      const titleId = isThirdCapture ? "third-capture-game-over-title" : "game-over-title";
      document.getElementById("game-over-screen").setAttribute("aria-labelledby", titleId);
      if (isThirdCapture) {
        const medal = document.getElementById("third-capture-medal");
        medal.textContent = medalText;
        medal.dataset.rankTier = medalTier;
        this.statusMessage.textContent = "Game over — Grandma caught you three times.";
      } else {
        const medal = document.getElementById("game-over-medal");
        medal.textContent = medalText;
        medal.dataset.rankTier = medalTier;
        document.getElementById("game-over-title").textContent = "DEFEAT";
        document.getElementById("game-over-reason").textContent =
          "Time ran out before a medal was earned.";
        this.statusMessage.textContent = "Defeat — time ran out before a medal.";
      }
    }

    const values = {
      score: results.score.toLocaleString(),
      rank: results.rank ?? NO_RANK_LABEL,
      lives: `${results.lives} / 3`,
      "lives-remaining": String(results.lives),
      mice: String(results.miceCaught),
      furniture: `${results.furnitureDestroyed}/${results.totalFurniture}`,
      duration: formatRunTime(results.elapsedGameplaySeconds),
    };
    for (const [key, value] of Object.entries(values)) {
      activeScreen.querySelectorAll(`[data-result="${key}"]`).forEach((output) => {
        output.textContent = value;
      });
    }
  }
}
