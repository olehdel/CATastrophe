import { moveCircleWithCollision } from "../core/Collision.js";

const START_POSITION = Object.freeze({ x: 1150, y: 840 });
const MAX_ENERGY = 100;
const SPRINT_RECOVERY_THRESHOLD = 20;
const SPEEDS = Object.freeze({ walk: 190, sneak: 105, sprint: 300 });
const ENERGY = Object.freeze({ sprintDrain: 26, recovery: 18 });

const lerpAngle = (current, target, amount) => {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * amount;
};

export class Cat {
  constructor() {
    this.radius = 22;
    this.reset();
  }

  reset() {
    this.x = START_POSITION.x;
    this.y = START_POSITION.y;
    this.facingAngle = 0;
    this.facing = "up";
    this.mode = "idle";
    this.animationMode = "idle";
    this.velocityX = 0;
    this.velocityY = 0;
    this.action = null;
    this.animationTime = 0;
    this.visualReaction = null;
    this.visualReactionRemaining = 0;
    this.energy = MAX_ENERGY;
    this.sprintAvailable = true;
  }

  update(deltaSeconds, input, house) {
    this.visualReactionRemaining = Math.max(0, this.visualReactionRemaining - deltaSeconds);
    if (this.visualReactionRemaining === 0) this.visualReaction = null;
    const movement = input.getMovement();
    const magnitude = Math.hypot(movement.x, movement.y);
    const hasMovement = magnitude > 0;
    const directionX = hasMovement ? movement.x / magnitude : 0;
    const directionY = hasMovement ? movement.y / magnitude : 0;
    const sneaking = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const sprintRequested = input.isDown("Space") && !sneaking && hasMovement && this.sprintAvailable;

    let nextMode = "idle";
    let speed = 0;
    if (hasMovement && sneaking) {
      nextMode = "sneak";
      speed = SPEEDS.sneak;
    } else if (sprintRequested) {
      nextMode = "sprint";
      speed = SPEEDS.sprint;
    } else if (hasMovement) {
      nextMode = "walk";
      speed = SPEEDS.walk;
    }

    if (nextMode === "sprint") {
      this.energy = Math.max(0, this.energy - ENERGY.sprintDrain * deltaSeconds);
      if (this.energy === 0) this.sprintAvailable = false;
    } else {
      this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY.recovery * deltaSeconds);
      if (this.energy >= SPRINT_RECOVERY_THRESHOLD) this.sprintAvailable = true;
    }

    this.mode = nextMode;

    if (speed > 0) {
      const previousX = this.x;
      const previousY = this.y;
      const distance = speed * deltaSeconds;
      const moved = moveCircleWithCollision(
        this.x,
        this.y,
        this.radius,
        directionX * distance,
        directionY * distance,
        house,
      );
      this.x = moved.x;
      this.y = moved.y;
      if (deltaSeconds > 0) {
        this.velocityX = (this.x - previousX) / deltaSeconds;
        this.velocityY = (this.y - previousY) / deltaSeconds;
      } else {
        this.velocityX = 0;
        this.velocityY = 0;
      }
    } else {
      this.velocityX = 0;
      this.velocityY = 0;
    }

    const actualSpeed = Math.hypot(this.velocityX, this.velocityY);
    const nextAnimationMode = actualSpeed > 0.01 ? nextMode : "idle";
    if (nextAnimationMode !== this.animationMode) this.animationTime = 0;
    this.animationMode = nextAnimationMode;
    if (this.animationMode !== "idle" || this.action === "scratch") {
      this.animationTime += deltaSeconds;
    }

    // Update facing only when collision resolution produced actual movement.
    // This keeps the last direction stable while idle or pressed against a wall.
    if (actualSpeed > 0.01) {
      const facingX = this.velocityX / actualSpeed;
      const facingY = this.velocityY / actualSpeed;
      const targetAngle = Math.atan2(facingY, facingX) + Math.PI / 2;
      const turnBlend = 1 - Math.exp(-16 * deltaSeconds);
      this.facingAngle = lerpAngle(this.facingAngle, targetAngle, turnBlend);
      // Resolve diagonal input to a single horizontal sprite row. Using the
      // collision-resolved velocity here can alternate rows while sliding
      // along corners, even though the player is holding a diagonal input.
      this.facing = movement.x !== 0 && movement.y !== 0
        ? (movement.x < 0 ? "left" : "right")
        : this.getCardinalFacing(facingX, facingY);
    }
  }

  getCardinalFacing(x, y) {
    if (Math.abs(x) >= Math.abs(y)) return x < 0 ? "left" : "right";
    return y < 0 ? "up" : "down";
  }

  setAction(action) {
    if (action !== this.action) this.animationTime = 0;
    this.action = action;
  }

  triggerVisualReaction(kind) {
    this.visualReaction = kind;
    this.visualReactionRemaining = kind === "catch" ? 0.48 : 0.36;
  }

  restoreEnergy(amount) {
    this.energy = Math.min(MAX_ENERGY, this.energy + Math.max(0, amount));
    if (this.energy >= SPRINT_RECOVERY_THRESHOLD) this.sprintAvailable = true;
    return this.energy;
  }

  faceToward(x, y, deltaSeconds) {
    const targetAngle = Math.atan2(y - this.y, x - this.x) + Math.PI / 2;
    this.facingAngle = lerpAngle(this.facingAngle, targetAngle, 1 - Math.exp(-16 * deltaSeconds));
    this.facing = this.getCardinalFacing(Math.sin(this.facingAngle), -Math.cos(this.facingAngle));
  }

  getAnimationState() {
    // Keep `clip` aligned with gameplay/input state for existing AI consumers.
    // The renderer uses visualClip, which is derived from collision-resolved velocity.
    const clip = this.action === "scratch" ? "scratch" : this.action ? "idle" : this.mode;
    const visualClip = this.action === "scratch" ? "scratch"
      : this.visualReaction === "catch" ? "catch"
        : this.action ? "idle" : this.animationMode;
    const framesPerSecond = visualClip === "sprint" ? 12
      : visualClip === "idle" || visualClip === "catch" ? 0
        : visualClip === "scratch" ? 10
          : visualClip === "sneak" ? 4.5 : 8;
    return {
      clip,
      visualClip,
      facing: this.facing,
      frameIndex: framesPerSecond === 0 ? 0 : Math.floor(this.animationTime * framesPerSecond),
      elapsed: this.animationTime,
      visualReaction: this.visualReaction,
      reactionProgress: this.visualReaction
        ? 1 - this.visualReactionRemaining / (this.visualReaction === "catch" ? 0.48 : 0.36)
        : 1,
    };
  }

  getStatus() {
    return {
      x: this.x,
      y: this.y,
      mode: this.mode,
      energy: this.energy,
      maxEnergy: MAX_ENERGY,
      facing: this.facing,
    };
  }
}
