export class Mouse {
  constructor(id, spawnPoint, radius) {
    this.id = id;
    this.spawnId = spawnPoint.id;
    this.homeX = spawnPoint.x;
    this.homeY = spawnPoint.y;
    this.radius = radius;
    this.x = spawnPoint.x;
    this.y = spawnPoint.y;
    this.facing = "down";
    this.mode = "idle";
    this.animationTime = 0;
    this.pauseTimer = 0;
    this.goalTimer = 0;
    this.fleeRetargetTimer = 0;
    this.stuckTimer = 0;
    this.target = null;
    this.path = [];
    this.pathCursor = 0;
  }

  faceToward(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    const horizontal = Math.abs(dx);
    const vertical = Math.abs(dy);
    // A small diagonal dead zone keeps the four-direction sprite row from
    // flickering when a path segment sits close to 45 degrees.
    if (horizontal > vertical * 1.18) this.facing = dx < 0 ? "left" : "right";
    else if (vertical > horizontal * 1.18) this.facing = dy < 0 ? "up" : "down";
  }

  setMode(mode) {
    if (mode !== this.mode) this.animationTime = 0;
    this.mode = mode;
  }

  updateAnimation(deltaSeconds) {
    this.animationTime += deltaSeconds;
  }

  getAnimationState() {
    const fps = this.mode === "fleeing" ? 13 : this.mode === "walking" ? 7 : 2.5;
    return {
      mode: this.mode,
      facing: this.facing,
      frameIndex: Math.floor(this.animationTime * fps) % 4,
      elapsed: this.animationTime,
    };
  }
}
