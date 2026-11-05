import { NavigationGrid } from "./NavigationGrid.js";
import { CAPTURE_CONFIG } from "./CaptureConfig.js";
import { OLD_LADY_STATES } from "./OldLadyAI.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class CaptureSystem {
  constructor(cat, oldLady, oldLadyAI, house, input, config = CAPTURE_CONFIG) {
    this.cat = cat;
    this.oldLady = oldLady;
    this.oldLadyAI = oldLadyAI;
    this.house = house;
    this.input = input;
    this.config = config;
    this.navigation = new NavigationGrid(house, oldLadyAI.config.navigationCellSize, Math.max(cat.radius, oldLady.radius));
    this.reset();
  }

  reset() {
    this.lives = this.config.startingLives;
    this.active = false;
    this.captureCount = 0;
    this.kind = null;
    this.phase = null;
    this.elapsed = 0;
    this.graceRemaining = 0;
    this.paths = null;
    this.presentation = null;
  }

  tryCapture() {
    if (this.active || this.graceRemaining > 0 || this.lives <= 0) return false;
    if (this.oldLadyAI.state !== OLD_LADY_STATES.CHASING) return false;
    if (distance(this.cat, this.oldLady) > this.config.captureDistance) return false;

    this.active = true;
    this.captureCount += 1;
    this.lives -= 1;
    this.kind = this.captureCount === 1 ? "broom" : this.captureCount === 2 ? "sprayer" : "bathroom";
    this.phase = "approach";
    this.elapsed = 0;
    this.lastCapturePosition = { x: this.cat.x, y: this.cat.y };
    this.cat.setAction("captured");
    this.input.clear();
    this.oldLadyAI.clearPath();
    this.presentation = { kind: this.kind, phase: this.phase, elapsed: 0, progress: 0 };
    return true;
  }

  setPhase(phase) {
    this.phase = phase;
    this.elapsed = 0;
    if (phase === "escort") {
      const target = this.config.bathroomTarget;
      this.paths = {
        lady: this.navigation.findPath(this.oldLady.x, this.oldLady.y, target.x, target.y),
        cat: this.navigation.findPath(this.cat.x, this.cat.y, target.x, target.y),
        ladyCursor: 0,
        catCursor: 0,
      };
    }
  }

  moveAlong(entity, path, cursor, speed, deltaSeconds) {
    if (!path?.length) return { cursor: 0, moving: false, done: true };
    const result = this.navigation.moveAlongPath(entity, path, cursor, speed, deltaSeconds);
    return { ...result, done: result.cursor >= path.length };
  }

  update(deltaSeconds) {
    if (!this.active) {
      this.graceRemaining = Math.max(0, this.graceRemaining - deltaSeconds);
      return { completed: false, gameOver: false };
    }
    this.elapsed += deltaSeconds;
    const duration = this.phase === "punishment"
      ? this.kind === "broom" ? this.config.broomDuration : this.config.sprayerDuration
      : this.phase === "life-lost-notification" ? this.config.lifeLostNotificationDuration
      : this.phase === "bath-arrival" ? this.config.finalArrivalDuration : 1;

    if (this.phase === "approach") {
      const result = this.moveAlong(this.oldLady, this.oldLadyAI.navigation.findPath(
        this.oldLady.x, this.oldLady.y, this.cat.x, this.cat.y,
      ), 0, this.config.approachSpeed, deltaSeconds);
      this.oldLady.updateAnimation(deltaSeconds, result.moving, "walk");
      if (this.elapsed >= this.config.approachDuration || distance(this.oldLady, this.cat) <= this.cat.radius + this.oldLady.radius + 5) {
        this.oldLady.faceToward(this.cat.x, this.cat.y, deltaSeconds);
        this.setPhase(this.kind === "bathroom" ? "escort" : "punishment");
      }
    } else if (this.phase === "punishment") {
      this.oldLady.faceToward(this.cat.x, this.cat.y, deltaSeconds);
      this.oldLady.updateAnimation(deltaSeconds, false);
      this.cat.animationTime += deltaSeconds;
      if (this.elapsed >= duration) {
        this.setPhase("life-lost-notification");
      }
    } else if (this.phase === "life-lost-notification") {
      this.oldLady.updateAnimation(deltaSeconds, false);
      this.cat.animationTime += deltaSeconds;
      if (this.elapsed >= duration) {
        this.cat.reset();
        this.cat.setAction(null);
        this.input.clear();
        this.active = false;
        this.phase = null;
        this.presentation = null;
        this.graceRemaining = this.config.respawnGracePeriod;
        this.oldLadyAI.resetAfterCapture();
        return { completed: true, gameOver: false };
      }
    } else if (this.phase === "escort") {
      const ladyMove = this.moveAlong(this.oldLady, this.paths.lady, this.paths.ladyCursor, this.config.escortSpeed, deltaSeconds);
      const catMove = this.moveAlong(this.cat, this.paths.cat, this.paths.catCursor, this.config.escortSpeed, deltaSeconds);
      this.paths.ladyCursor = ladyMove.cursor;
      this.paths.catCursor = catMove.cursor;
      this.oldLady.updateAnimation(deltaSeconds, ladyMove.moving, "walk");
      this.cat.animationTime += deltaSeconds;
      if (ladyMove.done && catMove.done) this.setPhase("bath-arrival");
    } else if (this.phase === "bath-arrival") {
      this.oldLady.updateAnimation(deltaSeconds, false);
      this.cat.animationTime += deltaSeconds;
      if (this.elapsed >= this.config.finalArrivalDuration) {
        this.active = false;
        this.presentation = { kind: "bathroom", phase: "game-over", elapsed: this.elapsed, progress: 1, cat: { x: this.cat.x, y: this.cat.y } };
        return { completed: true, gameOver: true };
      }
    }
    this.presentation = {
      kind: this.kind,
      phase: this.phase,
      elapsed: this.elapsed,
      duration: this.phase === "life-lost-notification" ? this.config.lifeLostNotificationDuration : duration,
      progress: clamp01(this.elapsed / Math.max(duration, 0.01)),
      cat: { x: this.cat.x, y: this.cat.y },
    };
    return { completed: false, gameOver: false };
  }

  cancel() {
    this.active = false;
    this.phase = null;
    this.kind = null;
    this.elapsed = 0;
    this.paths = null;
    this.presentation = null;
    this.graceRemaining = 0;
    this.cat.setAction(null);
    this.input.clear();
  }
}
