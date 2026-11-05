const SPRITE_ATLAS = "../../assets/characters/mouse-spritesheet-game.png";
const FRAME_SIZE = 181;
const SPRITE_SIZE = 54;

const ROW_BY_DIRECTION = Object.freeze({
  right: 0,
  left: 1,
  down: 2,
  up: 3,
});

const COLUMN_BY_MODE = Object.freeze({
  idle: 0,
  walking: 4,
  fleeing: 8,
});

const CATCH_PARTICLES = Object.freeze([
  { x: -13, y: -8, vx: -13, vy: -17, size: 4, color: "#ffe3a2" },
  { x: 10, y: -12, vx: 15, vy: -11, size: 3, color: "#f4c27d" },
  { x: -7, y: 12, vx: -9, vy: 16, size: 4, color: "#f3b780" },
  { x: 14, y: 7, vx: 16, vy: 10, size: 3, color: "#fff0c2" },
  { x: 0, y: -17, vx: 2, vy: -20, size: 3, color: "#f1a5a0" },
  { x: -17, y: 3, vx: -18, vy: 4, size: 3, color: "#f4d27d" },
]);

export class MouseRenderer {
  constructor() {
    this.loaded = false;
    this.image = new Image();
    this.image.onload = () => {
      if (this.image.naturalWidth !== FRAME_SIZE * 12 || this.image.naturalHeight !== FRAME_SIZE * 4) {
        console.error(`Unexpected mouse atlas dimensions: ${this.image.naturalWidth} x ${this.image.naturalHeight}`);
        return;
      }
      this.loaded = true;
      this.onLoad?.();
    };
    this.image.onerror = () => console.error("Could not load mouse sprite sheet:", this.image.src);
    this.image.src = new URL(SPRITE_ATLAS, import.meta.url).href;
  }

  drawCatchEffect(context, effect) {
    if (!effect) return;
    const progress = Math.min(1, effect.elapsed / effect.duration);
    const fade = Math.max(0, 1 - progress);
    context.save();

    // A quick flash and expanding ring anchor the catch to the mouse position.
    const ringProgress = Math.min(1, progress / 0.65);
    context.globalAlpha = Math.max(0, 0.9 - ringProgress) * 0.8;
    context.strokeStyle = "#ffe6a8";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(Math.round(effect.x), Math.round(effect.y), 13 + ringProgress * 27, 0, Math.PI * 2);
    context.stroke();

    // Debris and sparkles arc outward and settle instead of sliding linearly.
    context.globalAlpha = Math.pow(fade, 1.25);
    for (let index = 0; index < CATCH_PARTICLES.length; index += 1) {
      const particle = CATCH_PARTICLES[index];
      const x = Math.round(effect.x + particle.x + particle.vx * progress);
      const y = Math.round(effect.y + particle.y + particle.vy * progress + 34 * progress * progress);
      context.fillStyle = index % 3 === 0 ? "#fff3c9" : particle.color;
      context.fillRect(x, y, particle.size, particle.size);
    }

    // The time reward is the most important part of a catch, so show it in
    // world space as well as in the HUD.
    if (effect.timeBonus > 0) {
      const appear = Math.min(1, effect.elapsed / 0.12);
      const labelFade = progress < 0.55 ? 1 : Math.max(0, (1 - progress) / 0.45);
      context.globalAlpha = labelFade;
      context.font = "900 24px 'Segoe UI', Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.lineWidth = 6;
      context.strokeStyle = "rgba(35, 27, 20, 0.9)";
      const labelY = Math.round(effect.y - 30 - progress * 18 - (1 - appear) * 5);
      context.strokeText(`+${effect.timeBonus}s`, Math.round(effect.x), labelY);
      context.fillStyle = "#ffe08a";
      context.fillText(`+${effect.timeBonus}s`, Math.round(effect.x), labelY);
    }
    context.restore();
  }

  draw(context, mouse, catchable = false) {
    const animation = mouse.getAnimationState();
    const row = ROW_BY_DIRECTION[animation.facing] ?? ROW_BY_DIRECTION.down;
    const firstColumn = COLUMN_BY_MODE[animation.mode] ?? COLUMN_BY_MODE.idle;
    const frame = animation.frameIndex % 4;
    const sourceX = (firstColumn + frame) * FRAME_SIZE;
    const sourceY = row * FRAME_SIZE;
    const x = Math.round(mouse.x - SPRITE_SIZE / 2);
    const y = Math.round(mouse.y - SPRITE_SIZE / 2);

    context.save();
    context.imageSmoothingEnabled = false;
    this.drawShadow(context, mouse);
    if (this.loaded) {
      context.drawImage(
        this.image,
        sourceX,
        sourceY,
        FRAME_SIZE,
        FRAME_SIZE,
        x,
        y,
        SPRITE_SIZE,
        SPRITE_SIZE,
      );
    }
    if (catchable) {
      context.save();
      context.translate(Math.round(mouse.x), Math.round(mouse.y));
      this.drawCatchRing(context);
      context.restore();
    }
    context.restore();
  }

  drawCatchPrompt(context, mouse) {
    if (!mouse) return;
    context.save();
    context.translate(Math.round(mouse.x), Math.round(mouse.y));
    context.font = "700 18px 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";

    const label = "HOLD E · CATCH";
    const paddingX = 12;
    const boxWidth = Math.ceil(context.measureText(label).width + paddingX * 2);
    const boxHeight = 30;
    const boxBottom = -SPRITE_SIZE / 2 - 10;
    const boxTop = boxBottom - boxHeight;

    const pulse = 0.96 + Math.sin(performance.now() / 240) * 0.04;
    context.globalAlpha = pulse;
    context.fillStyle = "rgba(25, 23, 27, 0.96)";
    context.fillRect(-boxWidth / 2, boxTop, boxWidth, boxHeight);
    context.strokeStyle = "#f5d27d";
    context.lineWidth = 3;
    context.strokeRect(-boxWidth / 2 + 1.5, boxTop + 1.5, boxWidth - 3, boxHeight - 3);
    context.fillStyle = "#fff0c2";
    context.fillText(label, 0, boxTop + boxHeight / 2 + 0.5);
    context.restore();
  }

  drawShadow(context, mouse) {
    context.fillStyle = "rgba(24, 22, 21, 0.22)";
    context.beginPath();
    context.ellipse(Math.round(mouse.x), Math.round(mouse.y + 12), 13.5, 3.75, 0, 0, Math.PI * 2);
    context.fill();
  }

  drawCatchRing(context) {
    const pulse = 0.5 + Math.sin(performance.now() / 190) * 0.5;
    context.save();
    context.globalAlpha = 0.22 + pulse * 0.2;
    context.strokeStyle = "#f5d27d";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, 33 + pulse * 2, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
    context.lineWidth = 2;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(0, 0, 30, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }
}
