import { OLD_LADY_CONFIG } from "../systems/OldLadyConfig.js";

export class OldLady {
  constructor(start = { x: 560, y: 320 }, config = OLD_LADY_CONFIG) {
    this.radius = config.radius;
    this.reset(start);
  }

  reset(start = { x: 560, y: 320 }) {
    this.x = start.x;
    this.y = start.y;
    this.facingAngle = Math.PI / 2;
    this.animationTime = 0;
    this.moving = false;
    this.animationMode = "idle";
    this.visualDirection = "down";
  }

  faceToward(x, y, deltaSeconds) {
    const targetAngle = Math.atan2(y - this.y, x - this.x);
    const difference = Math.atan2(Math.sin(targetAngle - this.facingAngle), Math.cos(targetAngle - this.facingAngle));
    this.facingAngle += difference * (1 - Math.exp(-12 * deltaSeconds));
  }

  updateAnimation(deltaSeconds, moving, movementMode = "walk") {
    const nextMode = moving ? movementMode : "idle";
    // Walking and running use the same four-pose gait. Keeping the phase when
    // switching between them removes the foot-pop that a full reset caused at
    // the start of every chase; entering or leaving idle still starts cleanly.
    const wasIdle = this.animationMode === "idle";
    const nextIdle = nextMode === "idle";
    if (wasIdle !== nextIdle) this.animationTime = 0;
    else this.animationTime += deltaSeconds;
    this.moving = moving;
    this.animationMode = nextMode;
  }

  getAnimationState(config) {
    const framesPerSecond = this.animationMode === "run"
      ? config.chaseFramesPerSecond
      : this.animationMode === "walk"
        ? config.walkFramesPerSecond
        : config.idleFramesPerSecond;
    const deltaX = Math.cos(this.facingAngle);
    const deltaY = Math.sin(this.facingAngle);
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);
    // Hold the current row through a narrow diagonal band so a smooth turn
    // does not flicker between two sprite rows on consecutive frames.
    let direction = this.visualDirection;
    if (horizontal > vertical * 1.18) direction = deltaX < 0 ? "left" : "right";
    else if (vertical > horizontal * 1.18) direction = deltaY < 0 ? "up" : "down";
    this.visualDirection = direction;
    return {
      mode: this.animationMode,
      direction,
      frameIndex: Math.floor(this.animationTime * framesPerSecond) % 4,
    };
  }
}
