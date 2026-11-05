import { GameState } from "../core/GameState.js";
import { AUDIO_CONFIG, AUDIO_MUSIC } from "./AudioConfig.js";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const midiFrequency = (note) => 440 * (2 ** ((note - 69) / 12));

export class AudioManager {
  constructor(noiseEvents = null) {
    this.settings = this.loadSettings();
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.noiseBuffer = null;
    this.musicTheme = null;
    this.sceneMusicLevel = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.nextMusicTime = 0;
    this.unlockPromise = null;
    this.gameState = GameState.MAIN_MENU;
    this.lastSfxTimes = new Map();
    this.lastAIState = null;
    this.lastCapturePhase = null;
    this.lastDestructionTarget = null;
    this.previousCatPosition = null;
    this.previousLadyPosition = null;
    this.catStepTimer = 0;
    this.ladyStepTimer = 0;
    this.mouseStepTimer = 0;
    this.boundDocument = null;
    this.boundWindow = null;
    this.onPointerDown = null;
    this.onClick = null;
    this.onKeyDown = null;
    this.unsubscribeNoise = noiseEvents?.subscribe((event) => this.onNoise(event)) ?? null;
  }

  loadSettings() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUDIO_CONFIG.storageKey) ?? "null");
      if (!saved || typeof saved !== "object") return { ...AUDIO_CONFIG.defaultSettings };
      return {
        masterVolume: clamp01(saved.masterVolume ?? AUDIO_CONFIG.defaultSettings.masterVolume),
        musicVolume: clamp01(saved.musicVolume ?? AUDIO_CONFIG.defaultSettings.musicVolume),
        effectsVolume: clamp01(saved.effectsVolume ?? AUDIO_CONFIG.defaultSettings.effectsVolume),
        muted: Boolean(saved.muted),
      };
    } catch {
      return { ...AUDIO_CONFIG.defaultSettings };
    }
  }

  saveSettings() {
    try {
      window.localStorage.setItem(AUDIO_CONFIG.storageKey, JSON.stringify(this.settings));
    } catch {
      // Keep working with the current in-memory preferences when storage is blocked.
    }
  }

  updateSettings(changes) {
    this.settings = {
      ...this.settings,
      ...changes,
      masterVolume: clamp01(changes.masterVolume ?? this.settings.masterVolume),
      musicVolume: clamp01(changes.musicVolume ?? this.settings.musicVolume),
      effectsVolume: clamp01(changes.effectsVolume ?? this.settings.effectsVolume),
      muted: changes.muted === undefined ? this.settings.muted : Boolean(changes.muted),
    };
    this.saveSettings();
    this.applyVolumes();
    return { ...this.settings };
  }

  toggleMute() {
    return this.updateSettings({ muted: !this.settings.muted });
  }

  bindUserGesture(documentRef = document, windowRef = window) {
    if (this.boundDocument) return;
    this.boundDocument = documentRef;
    this.boundWindow = windowRef;
    this.onPointerDown = (event) => {
      const clickedButton = Boolean(event.target?.closest?.("button"));
      void this.unlock().then((unlocked) => {
        if (unlocked && clickedButton) this.playSfx("buttonClick");
      });
    };
    this.onClick = (event) => {
      if (event.detail === 0 && event.target?.closest?.("button")) {
        void this.unlock().then((unlocked) => {
          if (unlocked) this.playSfx("buttonClick");
        });
      }
    };
    this.onKeyDown = () => { void this.unlock(); };
    documentRef.addEventListener("pointerdown", this.onPointerDown, true);
    documentRef.addEventListener("click", this.onClick, true);
    documentRef.addEventListener("keydown", this.onKeyDown, true);
  }

  createAudioGraph() {
    if (this.context) return true;
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return false;

    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.effectsGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.effectsGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer();
    this.applyVolumes(true);
    return true;
  }

  createNoiseBuffer() {
    const length = Math.floor(this.context.sampleRate * 0.28);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    let seed = 73421;
    for (let index = 0; index < length; index += 1) {
      seed = (seed * 16807) % 2147483647;
      channel[index] = ((seed / 2147483647) * 2 - 1) * (1 - index / length * 0.2);
    }
    return buffer;
  }

  async unlock() {
    if (this.context?.state === "running") return true;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = (async () => {
      if (!this.createAudioGraph()) return false;
      try {
        if (this.context.state !== "running") await this.context.resume();
      } catch {
        return false;
      }
      this.applyGameState();
      return this.context.state === "running";
    })();
    try {
      return await this.unlockPromise;
    } finally {
      this.unlockPromise = null;
    }
  }

  setGameState(state) {
    this.gameState = state;
    this.applyGameState();
  }

  applyGameState() {
    if (!this.context || this.context.state !== "running") return;
    if (this.gameState === GameState.MAIN_MENU) {
      this.setMusicTheme("menu", 1);
    } else if (this.gameState === GameState.PLAYING) {
      this.setMusicTheme("gameplay", 1);
    } else if (this.gameState === GameState.PAUSED) {
      this.setMusicTheme("gameplay", AUDIO_CONFIG.pauseMusicLevel);
    } else if (this.gameState === GameState.VICTORY) {
      this.stopMusic();
      this.playSfx("victory");
    } else if (this.gameState === GameState.GAME_OVER) {
      this.stopMusic();
      this.playSfx("gameOver");
    }
  }

  setMusicTheme(theme, sceneLevel) {
    if (!this.context || this.context.state !== "running") return;
    const changed = theme !== this.musicTheme;
    this.sceneMusicLevel = sceneLevel;
    if (theme === null) return this.stopMusic();

    if (changed) {
      this.musicTheme = theme;
      this.musicStep = 0;
      this.nextMusicTime = this.context.currentTime + 0.14;
      const now = this.context.currentTime;
      const target = this.settings.musicVolume * sceneLevel;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
      this.musicGain.gain.linearRampToValueAtTime(0, now + 0.12);
      this.musicGain.gain.linearRampToValueAtTime(target, now + AUDIO_CONFIG.fadeSeconds);
      this.startMusicScheduler();
    } else {
      this.applyVolumes();
    }
  }

  stopMusic() {
    if (!this.context || !this.musicGain) return;
    this.musicTheme = null;
    this.sceneMusicLevel = 0;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(0, now, 0.12);
  }

  startMusicScheduler() {
    if (this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), AUDIO_CONFIG.schedulerIntervalMs);
    this.scheduleMusic();
  }

  scheduleMusic() {
    if (!this.context || !this.musicTheme || this.context.state !== "running") return;
    const pattern = AUDIO_MUSIC[this.musicTheme];
    const now = this.context.currentTime;
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.musicVolume <= 0) {
      this.nextMusicTime = now + 60 / pattern.bpm / 2;
      return;
    }
    if (this.nextMusicTime < now - 0.1) this.nextMusicTime = now + 0.02;
    let scheduled = 0;
    while (this.nextMusicTime < now + AUDIO_CONFIG.scheduleAheadSeconds && scheduled < 6) {
      this.scheduleMusicStep(pattern, this.musicStep, this.nextMusicTime);
      this.musicStep = (this.musicStep + 1) % pattern.melody.length;
      this.nextMusicTime += 60 / pattern.bpm / 2;
      scheduled += 1;
    }
  }

  scheduleMusicStep(pattern, step, when) {
    const melody = pattern.melody[step];
    if (melody !== null) this.playTone(midiFrequency(melody), when, 0.18, 0.055, pattern.wave, this.musicGain);
    const bass = pattern.bass[step];
    if (bass !== null) this.playTone(midiFrequency(bass), when, 0.46, 0.033, "sine", this.musicGain);
    if (step % 8 === 0 && melody !== null) {
      this.playTone(midiFrequency(melody + 12), when + 0.012, 0.34, 0.012, "sine", this.musicGain);
    }
  }

  applyVolumes(immediate = false) {
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const smooth = (parameter, value) => {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, immediate ? 0.008 : 0.025);
    };
    smooth(this.masterGain.gain, this.settings.muted ? 0 : this.settings.masterVolume);
    smooth(this.musicGain.gain, this.settings.musicVolume * this.sceneMusicLevel);
    smooth(this.effectsGain.gain, this.settings.effectsVolume);
  }

  onNoise(event) {
    if (event.type === "scratch") this.playSfx("scratch");
    else if (event.type === "destroy") this.playSfx("furnitureDestroy");
  }

  updateGameplay(deltaSeconds, { cat, oldLady, oldLadyAI, captureSystem, mouseSystem }) {
    if (!this.context || this.context.state !== "running") return;
    this.updateCatSteps(deltaSeconds, cat, captureSystem);
    this.updateGrandmaSteps(deltaSeconds, oldLady, oldLadyAI);
    this.updateMouseSteps(deltaSeconds, mouseSystem);
    this.updateAIEvents(oldLadyAI);
    this.updateCaptureEvents(captureSystem);
  }

  updateCatSteps(deltaSeconds, cat, captureSystem) {
    const position = { x: cat.x, y: cat.y };
    const moved = this.previousCatPosition
      ? Math.hypot(position.x - this.previousCatPosition.x, position.y - this.previousCatPosition.y) > 0.05
      : false;
    this.previousCatPosition = position;
    if (!moved || captureSystem.active || cat.action) {
      this.catStepTimer = 0;
      return;
    }
    this.catStepTimer -= deltaSeconds;
    if (this.catStepTimer > 0) return;
    const sound = cat.mode === "sprint" ? "catSprintStep" : cat.mode === "sneak" ? "catSneakStep" : "catFootstep";
    this.playSfx(sound);
    this.catStepTimer = cat.mode === "sprint" ? 0.22 : cat.mode === "sneak" ? 0.46 : 0.34;
  }

  updateGrandmaSteps(deltaSeconds, oldLady, oldLadyAI) {
    const position = { x: oldLady.x, y: oldLady.y };
    const moved = this.previousLadyPosition
      ? Math.hypot(position.x - this.previousLadyPosition.x, position.y - this.previousLadyPosition.y) > 0.05
      : false;
    this.previousLadyPosition = position;
    if (!moved || !oldLady.moving) {
      this.ladyStepTimer = 0;
      return;
    }
    this.ladyStepTimer -= deltaSeconds;
    if (this.ladyStepTimer > 0) return;
    this.playSfx("grandmaFootstep", { running: oldLady.animationMode === "run" || oldLadyAI.state === "CHASING" });
    this.ladyStepTimer = oldLady.animationMode === "run" ? 0.29 : 0.48;
  }

  updateMouseSteps(deltaSeconds, mouseSystem) {
    const moving = mouseSystem.mice.some((mouse) => mouse.mode === "walking" || mouse.mode === "fleeing");
    if (!moving) {
      this.mouseStepTimer = 0;
      return;
    }
    this.mouseStepTimer -= deltaSeconds;
    if (this.mouseStepTimer <= 0) {
      this.playSfx("mouseMovement");
      this.mouseStepTimer = 1.15;
    }
  }

  updateAIEvents(oldLadyAI) {
    const state = oldLadyAI.state;
    if (this.lastAIState !== null && state !== this.lastAIState) {
      if (state === "SUSPICIOUS") this.playSfx("grandmaNotice");
      else if (state === "SEARCHING" && !oldLadyAI.destructionInvestigationActive) this.playSfx("grandmaInvestigate");
      else if (state === "CHASING") this.playSfx("grandmaChase");
    }
    const target = oldLadyAI.destructionInvestigationActive ? oldLadyAI.targetLocation : null;
    const targetChanged = target && (!this.lastDestructionTarget
      || target.x !== this.lastDestructionTarget.x || target.y !== this.lastDestructionTarget.y);
    if (targetChanged) this.playSfx("grandmaInvestigate");
    this.lastDestructionTarget = target ? { x: target.x, y: target.y } : null;
    this.lastAIState = state;
  }

  updateCaptureEvents(captureSystem) {
    const key = captureSystem.active ? `${captureSystem.kind}:${captureSystem.phase}` : null;
    if (key && key !== this.lastCapturePhase) {
      if (captureSystem.kind === "broom" && captureSystem.phase === "punishment") this.playSfx("broomPunishment");
      else if (captureSystem.kind === "sprayer" && captureSystem.phase === "punishment") this.playSfx("sprayerPunishment");
      else if (captureSystem.kind === "bathroom" && ["escort", "bath-arrival"].includes(captureSystem.phase)) this.playSfx("bathtubPunishment");
    }
    this.lastCapturePhase = key;
  }

  playSfx(name, options = {}) {
    if (!this.context || this.context.state !== "running" || this.settings.muted
      || this.settings.masterVolume <= 0 || this.settings.effectsVolume <= 0) return false;
    const now = this.context.currentTime;
    const cooldownKey = name === "catFootstep" || name === "catSneakStep" || name === "catSprintStep"
      ? "catStep"
      : name;
    const last = this.lastSfxTimes.get(cooldownKey) ?? -Infinity;
    if (now - last < (AUDIO_CONFIG.cooldowns[name] ?? 0.08)) return false;
    this.lastSfxTimes.set(cooldownKey, now);
    const effects = this.effectsGain;

    switch (name) {
      case "catFootstep":
        this.playTone(122, now, 0.075, 0.075, "triangle", effects);
        this.playNoise(now, 0.045, 900, 0.032);
        break;
      case "catSprintStep":
        this.playTone(104, now, 0.1, 0.11, "triangle", effects);
        this.playNoise(now, 0.065, 650, 0.05);
        break;
      case "catSneakStep":
        this.playTone(168, now, 0.055, 0.026, "sine", effects);
        this.playNoise(now, 0.035, 1500, 0.012);
        break;
      case "scratch":
        this.playNoise(now, 0.22, 1250, 0.095, 420);
        this.playTone(330, now, 0.055, 0.014, "triangle", effects);
        break;
      case "furnitureDestroy":
        this.playNoise(now, 0.38, 170, 0.24, 1800);
        this.playTone(82, now, 0.32, 0.19, "sine", effects);
        this.playTone(196, now + 0.055, 0.18, 0.055, "triangle", effects);
        break;
      case "mouseMovement":
        this.playNoise(now, 0.08, 2200, 0.014, 900);
        this.playTone(820, now + 0.015, 0.045, 0.012, "sine", effects);
        break;
      case "mouseCatch":
        [72, 76, 79].forEach((note, index) => this.playTone(midiFrequency(note), now + index * 0.075, 0.22, 0.075, "triangle", effects));
        this.playNoise(now, 0.12, 2100, 0.025, 1100);
        break;
      case "grandmaFootstep":
        this.playTone(options.running ? 76 : 92, now, options.running ? 0.14 : 0.11, options.running ? 0.12 : 0.075, "triangle", effects);
        this.playNoise(now, 0.06, 420, options.running ? 0.065 : 0.04);
        break;
      case "grandmaNotice":
        this.playTone(587, now, 0.17, 0.055, "sine", effects);
        this.playTone(784, now + 0.12, 0.22, 0.045, "triangle", effects);
        break;
      case "grandmaInvestigate":
        this.playTone(440, now, 0.18, 0.045, "triangle", effects);
        this.playTone(349, now + 0.14, 0.23, 0.035, "sine", effects);
        break;
      case "grandmaChase":
        this.playTone(311, now, 0.38, 0.09, "sawtooth", effects);
        this.playTone(233, now + 0.12, 0.46, 0.075, "triangle", effects);
        break;
      case "broomPunishment":
        this.playNoise(now, 0.34, 1000, 0.19, 260);
        this.playTone(146, now, 0.3, 0.08, "triangle", effects);
        break;
      case "sprayerPunishment":
        this.playNoise(now, 0.52, 1800, 0.13, 850);
        this.playTone(392, now + 0.12, 0.24, 0.035, "sine", effects);
        break;
      case "bathtubPunishment":
        this.playNoise(now, 0.68, 750, 0.19, 120);
        [261, 196, 131].forEach((frequency, index) => this.playTone(frequency, now + index * 0.13, 0.25, 0.05, "sine", effects));
        break;
      case "buttonClick":
        this.playTone(640, now, 0.045, 0.035, "sine", effects);
        this.playTone(420, now + 0.018, 0.05, 0.018, "triangle", effects);
        break;
      case "victory":
        [60, 64, 67, 72].forEach((note, index) => this.playTone(midiFrequency(note), now + index * 0.12, 0.58, 0.075, "triangle", effects));
        break;
      case "gameOver":
        [57, 53, 50].forEach((note, index) => this.playTone(midiFrequency(note), now + index * 0.19, 0.5, 0.065, "sine", effects));
        break;
      default:
        return false;
    }
    return true;
  }

  playTone(frequency, when, duration, volume, wave, destination) {
    if (!this.context || !destination) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(Math.max(0.0001, volume), when + Math.min(0.025, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.onended = () => {
      oscillator.onended = null;
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(when);
    oscillator.stop(when + duration + 0.025);
  }

  playNoise(when, duration, startFrequency, volume, endFrequency = null) {
    if (!this.context || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(startFrequency, when);
    if (endFrequency !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), when + duration);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(volume, when + Math.min(0.02, duration * 0.25));
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.effectsGain);
    source.onended = () => {
      source.onended = null;
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start(when);
    source.stop(when + duration + 0.02);
  }

  resetGameplayTracking() {
    this.lastAIState = null;
    this.lastCapturePhase = null;
    this.lastDestructionTarget = null;
    this.previousCatPosition = null;
    this.previousLadyPosition = null;
    this.catStepTimer = 0;
    this.ladyStepTimer = 0;
    this.mouseStepTimer = 0;
  }

  dispose() {
    if (this.unsubscribeNoise) this.unsubscribeNoise();
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    if (this.boundDocument) {
      this.boundDocument.removeEventListener("pointerdown", this.onPointerDown, true);
      this.boundDocument.removeEventListener("click", this.onClick, true);
      this.boundDocument.removeEventListener("keydown", this.onKeyDown, true);
    }
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
    this.musicTimer = null;
  }
}
