import { FURNITURE_VISUALS, MATERIAL_PARTICLE_PALETTE } from "../world/FurnitureVisualData.js";

const MAX_PARTICLES = 48;
const SCRATCH_EMIT_INTERVAL = 0.16;
const MAX_SCORE_POPUPS = 12;
const SCORE_POPUP_LIFETIME = 2.05;
const SCORE_POPUP_FADE_START = 1.45;
const SCORE_POPUP_APPEAR = 0.16;
const SCORE_POPUP_RISE = 42;

function visualFor(id) {
  return FURNITURE_VISUALS[id] ?? { material: "wood", accent: "#d8a05e" };
}

export class FurnitureVisualEffects {
  constructor(house) {
    this.house = house;
    this.reset();
  }

  reset() {
    this.particles = [];
    this.scorePopups = [];
    this.scratchTimer = 0;
    this.randomSeed = 1;
  }

  clear() {
    this.particles.length = 0;
    this.scorePopups.length = 0;
    this.scratchTimer = 0;
  }

  random() {
    this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0;
    return this.randomSeed / 0x100000000;
  }

  addBurst(item, x, y, count) {
    const material = visualFor(item.id).material;
    const palette = MATERIAL_PARTICLE_PALETTE[material] ?? MATERIAL_PARTICLE_PALETTE.wood;
    for (let index = 0; index < count && this.particles.length < MAX_PARTICLES; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (this.random() - 0.5) * 0.55;
      const speed = 18 + this.random() * 42;
      this.particles.push({
        x: x + (this.random() - 0.5) * 8,
        y: y + (this.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 8,
        gravity: 70 + this.random() * 50,
        size: this.random() < 0.3 ? 2 : 3,
        color: palette[Math.floor(this.random() * palette.length)],
        life: 0.42 + this.random() * 0.25,
        maxLife: 0.67,
        rotation: this.random() * Math.PI,
        spin: (this.random() - 0.5) * 7,
      });
    }
  }

  addScorePopup(event) {
    const points = Math.round(event.points);
    if (!Number.isFinite(points) || points <= 0) return;

    // Nearby simultaneous destructions stack upward so their values never sit
    // on top of one another. The extra x jitter keeps repeated stacks readable.
    const horizontalRange = 150;
    const verticalStep = 34;
    let baseY = event.y;
    let offsetX = 0;
    let attempts = 0;
    while (attempts < 6 && this.scorePopups.some((popup) => Math.abs(popup.baseX - event.x) < horizontalRange
      && Math.abs(popup.baseY - baseY) < verticalStep)) {
      baseY -= verticalStep;
      offsetX = (attempts % 2 === 0 ? 1 : -1) * 14;
      attempts += 1;
    }
    this.scorePopups.push({
      baseX: event.x,
      baseY,
      x: event.x + offsetX,
      age: 0,
      points,
    });
    if (this.scorePopups.length > MAX_SCORE_POPUPS) this.scorePopups.shift();
  }

  update(deltaSeconds, furnitureSystem, cat = null) {
    const target = furnitureSystem?.target;
    if (furnitureSystem?.scratchHeld && target) {
      this.scratchTimer += deltaSeconds;
      while (this.scratchTimer >= SCRATCH_EMIT_INTERVAL) {
        this.scratchTimer -= SCRATCH_EMIT_INTERVAL;
        this.addBurst(target.item, target.point.x, target.point.y, 2);
      }
    } else {
      this.scratchTimer = 0;
    }

    for (const particle of this.particles) {
      particle.life -= deltaSeconds;
      particle.vy += particle.gravity * deltaSeconds;
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= Math.pow(0.28, deltaSeconds);
      particle.rotation += particle.spin * deltaSeconds;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    for (const popup of this.scorePopups) popup.age += deltaSeconds;
    this.scorePopups = this.scorePopups.filter((popup) => popup.age < SCORE_POPUP_LIFETIME);
  }

  draw(context) {
    for (const particle of this.particles) {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      context.save();
      context.globalAlpha = alpha;
      context.translate(Math.round(particle.x), Math.round(particle.y));
      context.rotate(particle.rotation);
      context.fillStyle = "#342820";
      context.fillRect(-particle.size / 2 - 1, -particle.size / 2 - 1, particle.size + 2, particle.size + 2);
      context.fillStyle = particle.color;
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      context.restore();
    }

    for (const popup of this.scorePopups) {
      const progress = Math.min(1, popup.age / SCORE_POPUP_LIFETIME);
      const appear = Math.min(1, popup.age / SCORE_POPUP_APPEAR);
      const scale = 0.72 + 0.28 * (1 - Math.pow(1 - appear, 3));
      const fade = popup.age <= SCORE_POPUP_FADE_START
        ? 1
        : Math.max(0, (SCORE_POPUP_LIFETIME - popup.age) / (SCORE_POPUP_LIFETIME - SCORE_POPUP_FADE_START));
      context.save();
      context.globalAlpha = fade;
      context.translate(
        Math.round(popup.x),
        Math.round(popup.baseY - SCORE_POPUP_RISE * progress),
      );
      context.scale(scale, scale);
      context.font = "900 30px 'Segoe UI', Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.lineWidth = 7;
      context.strokeStyle = "rgba(30, 21, 16, 0.92)";
      context.strokeText(`+${popup.points}`, 0, 0);
      context.fillStyle = "#ffe08a";
      context.fillText(`+${popup.points}`, 0, 0);
      context.restore();
    }
  }
}
