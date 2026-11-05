export const AUDIO_CONFIG = Object.freeze({
  storageKey: "catastrophe.audio-settings.v1",
  defaultSettings: Object.freeze({
    masterVolume: 0.78,
    musicVolume: 0.48,
    effectsVolume: 0.72,
    muted: false,
  }),
  schedulerIntervalMs: 80,
  scheduleAheadSeconds: 0.22,
  fadeSeconds: 0.38,
  pauseMusicLevel: 0.2,
  cooldowns: Object.freeze({
    catFootstep: 0.1,
    catSprintStep: 0.1,
    catSneakStep: 0.1,
    grandmaFootstep: 0.14,
    mouseMovement: 0.3,
    scratch: 0.65,
    furnitureDestroy: 0.12,
    mouseCatch: 0.3,
    grandmaNotice: 0.4,
    grandmaInvestigate: 0.5,
    grandmaChase: 1.5,
    broomPunishment: 0.5,
    sprayerPunishment: 0.5,
    bathtubPunishment: 1.2,
    buttonClick: 0.07,
    victory: 2,
    gameOver: 2,
  }),
});

// Notes use MIDI numbers so the procedural loops stay compact and easy to tune.
export const AUDIO_MUSIC = Object.freeze({
  menu: Object.freeze({
    bpm: 76,
    melody: Object.freeze([72, null, 76, 79, null, 76, 74, null, 67, null, 71, 74, null, 71, 69, null]),
    bass: Object.freeze([48, null, null, null, 55, null, null, null, 43, null, null, null, 50, null, null, null]),
    wave: "triangle",
  }),
  gameplay: Object.freeze({
    bpm: 98,
    melody: Object.freeze([67, 71, null, 74, 79, null, 74, 71, 65, 69, null, 72, 77, null, 72, 69]),
    bass: Object.freeze([43, null, 43, null, 50, null, 50, null, 41, null, 41, null, 48, null, 48, null]),
    wave: "sine",
  }),
});
