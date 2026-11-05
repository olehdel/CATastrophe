const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));

export class Camera {
  constructor(worldWidth, worldHeight, zoom = 0.868, smoothing = 8) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.zoom = zoom;
    this.smoothing = smoothing;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;
  }

  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.clampToWorld();
  }

  snapTo(target) {
    this.x = target.x;
    this.y = target.y;
    this.clampToWorld();
  }

  follow(target, deltaSeconds) {
    const blend = 1 - Math.exp(-this.smoothing * deltaSeconds);
    this.x += (target.x - this.x) * blend;
    this.y += (target.y - this.y) * blend;
    this.clampToWorld();
  }

  clampToWorld() {
    const halfWidth = this.viewportWidth / (2 * this.zoom);
    const halfHeight = this.viewportHeight / (2 * this.zoom);
    const minX = Math.min(halfWidth, this.worldWidth / 2);
    const maxX = Math.max(this.worldWidth - halfWidth, this.worldWidth / 2);
    const minY = Math.min(halfHeight, this.worldHeight / 2);
    const maxY = Math.max(this.worldHeight - halfHeight, this.worldHeight / 2);
    this.x = clamp(this.x, minX, maxX);
    this.y = clamp(this.y, minY, maxY);
  }
}
