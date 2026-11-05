import { GameState } from "./GameState.js";
import { Renderer } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { Input } from "./Input.js";
import { Cat } from "../entities/Cat.js";
import { CaptureSystem } from "../systems/CaptureSystem.js";
import { MouseSystem } from "../systems/MouseSystem.js";
import { GameTimer } from "../systems/GameTimer.js";
import { RunStats, NO_RANK_LABEL } from "../systems/RunStats.js";
import { FurnitureVisualEffects } from "../systems/FurnitureVisualEffects.js";

const MAX_DELTA_SECONDS = 0.05;
const MAX_PIXEL_RATIO = 2;

export class Game {
  constructor(canvas, stateManager, house, movementHUD, furnitureSystem, oldLady, oldLadyAI, audioManager = null) {
    this.canvas = canvas;
    this.stateManager = stateManager;
    this.house = house;
    this.movementHUD = movementHUD;
    this.furnitureSystem = furnitureSystem;
    this.furnitureVisualEffects = new FurnitureVisualEffects(house);
    this.oldLady = oldLady;
    this.oldLadyAI = oldLadyAI;
    this.audioManager = audioManager;
    this.renderer = new Renderer(canvas, house);
    this.camera = new Camera(house.width, house.height);
    this.input = new Input(stateManager);
    this.cat = new Cat();
    this.captureSystem = new CaptureSystem(this.cat, oldLady, oldLadyAI, house, this.input);
    this.mouseSystem = new MouseSystem(house, furnitureSystem.scoring);
    this.timer = new GameTimer();
    this.runStats = new RunStats();
    this.results = null;
    this.runFinalized = false;
    this.tutorialActive = false;
    this.tutorialStep = null;
    this.audioManager?.setGameState(this.stateManager.current);
    this.previousFrameTime = null;
    this.animationFrameId = null;
    this.stateManager.subscribe((state) => {
      this.audioManager?.setGameState(state);
      if (state === GameState.PLAYING) {
        this.timer.resume();
        this.startLoop();
      } else {
        this.timer.pause();
        this.stopLoop();
        this.input.clear();
        this.furnitureSystem.cancelInteraction(this.cat);
        if (state === GameState.MAIN_MENU) {
          this.captureSystem.cancel();
          this.mouseSystem.clear();
          this.furnitureVisualEffects.clear();
          this.movementHUD.updateMice({ catchable: false, reward: null, witnessMessage: "" });
          this.renderer.render(null, null, this.furnitureSystem, this.oldLady, this.oldLadyAI, this.captureSystem.presentation, this.mouseSystem, this.furnitureVisualEffects);
        }
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.onFrame = this.onFrame.bind(this);
    this.resize();
  }

  startLoop() {
    if (this.animationFrameId !== null) return;
    this.animationFrameId = requestAnimationFrame(this.onFrame);
  }

  stopLoop() {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.previousFrameTime = null;
  }

  restart() {
    this.input.clear();
    this.tutorialActive = false;
    this.tutorialStep = null;
    this.cat.reset();
    this.captureSystem.reset();
    this.furnitureSystem.reset();
    this.furnitureVisualEffects.reset();
    this.oldLadyAI.reset();
    this.mouseSystem.reset(this.cat, this.oldLady);
    this.audioManager?.resetGameplayTracking();
    // The countdown is armed but held until the mandatory tutorial finishes.
    this.timer.reset();
    this.runStats.reset();
    this.results = null;
    this.runFinalized = false;
    this.camera.snapTo(this.cat);
    this.movementHUD.update(this.cat.getStatus(), this.furnitureSystem.getScore(), null, 0, false, 0, this.captureSystem.lives, "");
    this.movementHUD.updateOldLady(this.oldLadyAI.getStatus());
    this.movementHUD.updateMice(this.mouseSystem.getStatus());
    this.movementHUD.updateTimer(this.timer.remainingSeconds);
    this.movementHUD.updateFurniture(0, this.furnitureSystem.states.size);
    this.movementHUD.updateLives(this.captureSystem.lives);
    this.movementHUD.updateCapturePresentation(null, this.captureSystem.lives);
    this.movementHUD.updateRoomProgress(this.furnitureSystem.getRoomProgress());
    this.onInteractionTargetsUpdate?.({ mouseCatchable: false, furnitureTarget: false });
    this.previousFrameTime = null;
    this.stateManager.transition(GameState.PLAYING);
  }

  // Called by GameUI once the mandatory tutorial is finished. Starting without
  // a reset preserves any tutorial-session state; no rewards are granted during
  // the tutorial, so the run still begins at 5:00.
  startRunTimer() {
    if (this.stateManager.current !== GameState.PLAYING) return;
    if (this.timer.started) return;
    this.timer.start({ reset: false });
    this.movementHUD.updateTimer(this.timer.remainingSeconds);
  }

  startTutorial() {
    this.tutorialActive = true;
    this.tutorialStep = null;
    this.furnitureSystem.cancelInteraction(this.cat);
    this.mouseSystem.endTutorialMouse();
  }

  setTutorialStep(action) {
    this.tutorialStep = action;
    if (action === "mouse") this.mouseSystem.beginTutorialMouse(this.cat);
    else this.mouseSystem.endTutorialMouse();
    if (action !== "scratch") this.furnitureSystem.cancelInteraction(this.cat);
  }

  endTutorial() {
    this.tutorialActive = false;
    this.tutorialStep = null;
    this.mouseSystem.finishTutorial(this.cat, this.oldLady);
    this.furnitureSystem.cancelInteraction(this.cat);
    this.startRunTimer();
  }

  cancelTutorial() {
    this.tutorialActive = false;
    this.tutorialStep = null;
    this.mouseSystem.endTutorialMouse();
    this.furnitureSystem.cancelInteraction(this.cat);
  }

  returnToMainMenu() {
    this.input.clear();
    this.stateManager.transition(GameState.MAIN_MENU);
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.renderer.resize(bounds.width, bounds.height, pixelRatio);
    this.camera.setViewport(bounds.width, bounds.height);
    if (this.stateManager.current === GameState.PLAYING) this.renderer.render(this.camera, this.cat, this.furnitureSystem, this.oldLady, this.oldLadyAI, this.captureSystem.presentation, this.mouseSystem, this.furnitureVisualEffects);
    else this.renderer.render(null, null, this.furnitureSystem, this.oldLady, this.oldLadyAI, this.captureSystem.presentation, this.mouseSystem, this.furnitureVisualEffects);
  }

  onFrame(timestamp) {
    this.animationFrameId = null;
    if (this.stateManager.current !== GameState.PLAYING) {
      this.previousFrameTime = null;
      return;
    }

    const clockDeltaSeconds = this.previousFrameTime === null
      ? 0
      : Math.max(0, (timestamp - this.previousFrameTime) / 1000);
    const deltaSeconds = Math.min(clockDeltaSeconds, MAX_DELTA_SECONDS);
    this.previousFrameTime = timestamp;

    if (this.stateManager.current === GameState.PLAYING) this.update(deltaSeconds, clockDeltaSeconds);
    this.renderer.render(this.camera, this.cat, this.furnitureSystem, this.oldLady, this.oldLadyAI, this.captureSystem.presentation, this.mouseSystem, this.furnitureVisualEffects);
    if (this.stateManager.current === GameState.PLAYING) {
      this.animationFrameId = requestAnimationFrame(this.onFrame);
    }
  }

  update(deltaSeconds, clockDeltaSeconds = deltaSeconds) {
    if (this.captureSystem.active) {
      this.timer.pause();
      this.cat.setAction("captured");
      const result = this.captureSystem.update(deltaSeconds);
      this.audioManager?.updateGameplay(deltaSeconds, {
        cat: this.cat,
        oldLady: this.oldLady,
        oldLadyAI: this.oldLadyAI,
        captureSystem: this.captureSystem,
        mouseSystem: this.mouseSystem,
      });
      if (result.gameOver) {
        this.finishRun("third-capture");
      } else if (result.completed) {
        // The respawn reset in CaptureSystem clears anger and chase state.
        // Discard stale destruction feedback too, so only a fresh destruction
        // after respawn can anger Grandma again.
        this.furnitureSystem.discardDestructionEvents();
        this.timer.resume();
        if (this.timer.expired) this.resolveTimerExpiry();
      }
      this.camera.follow(this.cat, deltaSeconds);
      this.updateHUD();
      return;
    }
    const tutorial = this.tutorialActive;
    const elapsed = tutorial ? 0 : this.timer.advance(clockDeltaSeconds);
    if (!tutorial) this.runStats.advanceGameplayTime(elapsed);
    this.cat.update(deltaSeconds, this.input, this.house);
    const mouseResult = this.mouseSystem.update(deltaSeconds, this.cat, this.oldLady, this.input, {
      allowCatch: !tutorial || this.tutorialStep === "mouse",
      tutorial,
    });
    if (mouseResult.caught && !tutorial) {
      this.runStats.recordMouseCaught();
      this.timer.addTime(this.mouseSystem.config.timeBonusSeconds);
      this.cat.triggerVisualReaction("catch");
      this.audioManager?.playSfx("mouseCatch");
      this.furnitureSystem.cancelInteraction(this.cat);
      this.mouseSystem.setWitnessedCatch(this.oldLadyAI.reactToMouseCatch(this.cat, mouseResult.caught.mouse));
    }
    if (tutorial) {
      if (this.tutorialStep === "scratch") this.furnitureSystem.updateTutorial(deltaSeconds, this.cat, this.input);
      else this.furnitureSystem.cancelInteraction(this.cat);
      this.furnitureVisualEffects.update(deltaSeconds, this.furnitureSystem, this.cat);
    } else {
      const furnitureUpdated = !this.mouseSystem.blocksFurnitureInteraction;
      if (furnitureUpdated) this.furnitureSystem.update(deltaSeconds, this.cat, this.input);
      else this.furnitureSystem.cancelInteraction(this.cat);
      for (const event of this.furnitureSystem.takeDestructionEvents()) {
        this.furnitureVisualEffects.addScorePopup(event);
      }
      this.furnitureVisualEffects.update(deltaSeconds, this.furnitureSystem, this.cat);
      if (furnitureUpdated && this.furnitureSystem.lastScoreAward > 0) this.cat.triggerVisualReaction("damage");
      this.runStats.syncFurniture(this.furnitureSystem.states);
      if (this.furnitureSystem.allFurnitureDestroyed
        && this.timer.remainingSeconds > 0
        && this.captureSystem.lives > 0
        && !this.captureSystem.active) {
        this.finishRun("all-furniture-destroyed");
        return;
      }
    }
    if (!tutorial) {
      this.oldLadyAI.update(deltaSeconds, this.cat);
      this.captureSystem.update(deltaSeconds);
      if (this.oldLadyAI.mouseReactionTimer <= 0 && this.captureSystem.tryCapture()) this.furnitureSystem.cancelInteraction(this.cat);
      if (this.captureSystem.active) this.timer.pause();
      if (this.captureSystem.active && this.cat.action === null) this.cat.setAction("captured");
    }
    this.audioManager?.updateGameplay(deltaSeconds, {
      cat: this.cat,
      oldLady: this.oldLady,
      oldLadyAI: this.oldLadyAI,
      captureSystem: this.captureSystem,
      mouseSystem: this.mouseSystem,
    });
    this.camera.follow(this.cat, deltaSeconds);
    this.updateHUD();
    this.onTutorialPracticeUpdate?.({
      deltaSeconds,
      cat: this.cat,
      furnitureSystem: this.furnitureSystem,
      mouseCaught: Boolean(mouseResult.caught),
    });
    if (!tutorial && !this.captureSystem.active && this.timer.expired) this.resolveTimerExpiry();
  }

  resolveTimerExpiry() {
    if (this.runFinalized || this.stateManager.current !== GameState.PLAYING) return;
    this.finishRun("time-expired");
  }

  // Outcome and medal are separate: the medal always comes from the destroyed
  // furniture count, while the outcome depends on how the run ended. A third
  // capture is always GAME OVER, even with a medal; the clock is VICTORY only
  // with a medal; clearing the house is an immediate VICTORY and takes
  // priority over any ending triggered on the same frame.
  finishRun(reason) {
    if (this.runFinalized || this.stateManager.current !== GameState.PLAYING) return;
    const allFurnitureDestroyed = this.furnitureSystem.allFurnitureDestroyed;
    if (allFurnitureDestroyed) reason = "all-furniture-destroyed";
    this.runFinalized = true;
    this.timer.pause();
    this.results = this.runStats.snapshot({
      score: this.furnitureSystem.getScore(),
      lives: this.captureSystem.lives,
      reason,
      totalFurniture: this.furnitureSystem.states.size,
    });
    const earnedMedal = this.results.rank !== NO_RANK_LABEL;
    const victory = reason === "all-furniture-destroyed"
      || (reason === "time-expired" && earnedMedal);
    this.stateManager.transition(victory ? GameState.VICTORY : GameState.GAME_OVER);
  }

  updateHUD() {
    const target = this.furnitureSystem.target;
    this.onInteractionTargetsUpdate?.({
      mouseCatchable: !this.captureSystem.active && Boolean(this.mouseSystem.catchableMouse),
      furnitureTarget: !this.captureSystem.active && Boolean(target),
    });
    const punishmentMessage = this.captureSystem.active
      ? this.captureSystem.kind === "broom" ? "Caught! Grandma got the broom!"
        : this.captureSystem.kind === "sprayer" ? "Caught again! The plant sprayer!"
          : "No more chances!"
      : this.captureSystem.graceRemaining > 0 ? `Safe for ${this.captureSystem.graceRemaining.toFixed(1)}s` : "";
    this.movementHUD.update(
      this.cat.getStatus(),
      this.furnitureSystem.getScore(),
      target,
      target ? this.furnitureSystem.getStageProgress(target.item.id) : 0,
      this.furnitureSystem.scratchHeld,
      this.furnitureSystem.lastScoreAward,
      this.captureSystem.lives,
      punishmentMessage,
    );
    this.movementHUD.updateOldLady(this.oldLadyAI.getStatus());
    this.movementHUD.updateMice(this.mouseSystem.getStatus());
    this.movementHUD.updateTimer(this.timer.remainingSeconds);
    this.movementHUD.updateFurniture(this.runStats.destroyedFurnitureCount, this.furnitureSystem.states.size);
    this.movementHUD.updateLives(this.captureSystem.lives);
    this.movementHUD.updateCapturePresentation(this.captureSystem.presentation, this.captureSystem.lives);
    this.movementHUD.updateRoomProgress(this.furnitureSystem.getRoomProgress());
  }
}
