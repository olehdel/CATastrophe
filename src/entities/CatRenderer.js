const SPRITE_ATLAS = "../../assets/characters/cat-spritesheet-v2.png";
const FRAME_SIZE = 181;
const SPRITE_SCALE = 0.5;
const FOOT_OFFSET = 34;

// Measured from the opaque sprite pixels in the supplied 2172 x 724 PNG.
// Front/rear rows contain 14 poses; both profile rows contain 12. Bounds are
// kept per pose because the sheet does not use one uniform column grid.
// This sheet does not label a separate idle strip. Each direction uses its
// first neutral pose as a single, held idle frame; movement clips use their
// selected cycles below.
const ROWS = Object.freeze({
  down: Object.freeze({
    y: [0,180],
    frames: [[50,144],[197,291],[348,439],[498,587],[648,738],[796,888],[947,1037],[1095,1188],[1246,1336],[1396,1489],[1550,1642],[1703,1794],[1859,1952],[2017,2109]],
    idle: [0], walk: [4,5,6,7,8,9], sneak: [4,5,6,7], sprint: [10,11,12,13], scratch: [8,9,10,11],
  }),
  right: Object.freeze({
    y: [181,361],
    frames: [[15,183],[204,370],[384,547],[565,731],[742,904],[911,1076],[1079,1251],[1255,1428],[1438,1606],[1620,1786],[1801,1965],[1980,2143]],
    idle: [0], walk: [0,1,2,3,4,5], sneak: [0,1,2,3], sprint: [7,8,9,10,11], scratch: [8,9,10],
  }),
  left: Object.freeze({
    y: [362,520],
    frames: [[25,184],[201,364],[382,546],[561,724],[743,908],[919,1090],[1102,1272],[1277,1447],[1457,1627],[1638,1803],[1817,1984],[1996,2160]],
    idle: [0], walk: [0,1,2,3,4,5], sneak: [0,1,2,3], sprint: [7,8,9,10,11], scratch: [8,9,10],
  }),
  up: Object.freeze({
    y: [543,723],
    frames: [[54,145],[205,294],[353,440],[501,588],[653,737],[804,887],[950,1036],[1100,1186],[1251,1334],[1407,1486],[1559,1639],[1709,1795],[1864,1953],[2020,2109]],
    idle: [0], walk: [4,5,6,7,8,9], sneak: [4,5,6,7], sprint: [10,11,12,13], scratch: [8,9,10,11],
  }),
});

const CLIP_SEQUENCE = Object.freeze({
  idle: "idle",
  catch: "idle",
  walk: "walk",
  sneak: "sneak",
  sprint: "sprint",
  scratch: "scratch",
});

export class CatRenderer {
  constructor() {
    this.loaded = false;
    this.image = new Image();
    this.image.onload = () => this.prepareFrames();
    this.image.onerror = () => console.error("Could not load cat sprite sheet:", this.image.src);
    this.image.src = new URL(SPRITE_ATLAS, import.meta.url).href;
  }

  prepareFrames() {
    if (this.image.naturalWidth !== 2172 || this.image.naturalHeight !== 724) {
      console.error(`Unexpected cat atlas dimensions: ${this.image.naturalWidth} x ${this.image.naturalHeight}`);
      return;
    }

    const source = document.createElement("canvas");
    source.width = this.image.naturalWidth;
    source.height = this.image.naturalHeight;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    sourceContext.imageSmoothingEnabled = false;
    sourceContext.drawImage(this.image, 0, 0);

    // The PNG has real alpha transparency. It also contains a red fringe in
    // very low-alpha edge pixels. Remove only that narrow fringe; retain all
    // higher-opacity warm fur, ears and outlines without color keying.
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      const alpha = pixels.data[index + 3];
      if (alpha <= 64 && red > 150 && red - green > 85 && red - blue > 75) {
        pixels.data[index + 3] = 0;
      }
    }
    sourceContext.putImageData(pixels, 0, 0);

    this.frames = {};
    for (const [direction, row] of Object.entries(ROWS)) {
      this.frames[direction] = row.frames.map(([left, right], index) => {
        const frame = document.createElement("canvas");
        frame.width = FRAME_SIZE;
        frame.height = FRAME_SIZE;
        const frameContext = frame.getContext("2d");
        frameContext.imageSmoothingEnabled = false;
        const previousGap = index === 0 ? 10 : left - row.frames[index - 1][1] - 1;
        const nextGap = index === row.frames.length - 1
          ? 10
          : row.frames[index + 1][0] - right - 1;
        const padLeft = Math.max(0, Math.min(5, Math.floor(previousGap / 2)));
        const padRight = Math.max(0, Math.min(5, Math.floor(nextGap / 2)));
        const sourceX = Math.max(0, left - padLeft);
        const sourceWidth = Math.min(source.width - sourceX, right - left + 1 + padLeft + padRight);
        const [rowTop, rowBottom] = row.y;
        let top = rowBottom;
        let bottom = rowTop;
        const imageData = pixels.data;
        for (let y = rowTop; y <= rowBottom; y += 1) {
          for (let x = sourceX; x < sourceX + sourceWidth; x += 1) {
            if (imageData[(y * source.width + x) * 4 + 3] > 8) {
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
          }
        }
        const sourceY = Math.max(rowTop, top - 3);
        const sourceBottom = Math.min(rowBottom, bottom + 4);
        const sourceHeight = sourceBottom - sourceY + 1;
        const targetX = Math.round((FRAME_SIZE - sourceWidth) / 2);
        const targetY = FRAME_SIZE - sourceHeight;
        frameContext.drawImage(
          source,
          sourceX, sourceY, sourceWidth, sourceHeight,
          targetX, targetY, sourceWidth, sourceHeight,
        );
        return frame;
      });
    }

    this.loaded = true;
    this.onLoad?.();
  }

  draw(context, cat, options = {}) {
    if (!this.loaded || !this.frames) return;
    const animation = cat.getAnimationState();
    const direction = options.facing && options.facing in this.frames
      ? options.facing
      : animation.facing in this.frames ? animation.facing : "down";
    const row = ROWS[direction];
    const clip = animation.visualClip ?? animation.clip;
    const sequenceName = CLIP_SEQUENCE[clip] ?? "idle";
    const sequence = row[sequenceName] ?? row.idle;
    const frameIndex = sequence[animation.frameIndex % sequence.length];
    const sprite = this.frames[direction][frameIndex];

    const sneakSettle = clip === "sneak" ? 1 : 0;
    const sprintBounce = clip === "sprint" ? Math.round(Math.abs(Math.sin(animation.elapsed * 17)) * 1.4) : 0;
    const catchHop = animation.visualReaction === "catch"
      ? Math.round(Math.sin(Math.PI * Math.min(1, animation.reactionProgress)) * 3)
      : 0;
    // A single held idle pose looks frozen next to the animated actors. A
    // one-pixel breath keeps the cat alive without changing its footprint.
    const idleBreath = clip === "idle" || clip === "catch"
      ? Math.round(Math.sin(performance.now() / 620) * 0.9)
      : 0;
    const capturedTremble = !options.calm && cat.action === "captured"
      ? Math.round(Math.sin(animation.elapsed * 34))
      : 0;
    const size = FRAME_SIZE * SPRITE_SCALE;
    const x = Math.round(cat.x - size / 2) + capturedTremble;
    const footY = Math.round(cat.y + FOOT_OFFSET - sneakSettle - sprintBounce - catchHop - idleBreath);

    context.save();
    context.imageSmoothingEnabled = false;
    if (options.shadow !== false) this.drawSoftShadow(context, cat, clip === "sneak", clip === "sprint");
    if (clip === "sprint") this.drawSprintDust(context, cat, animation);
    context.drawImage(sprite, x, footY - size, size, size);
    if (clip === "scratch") this.drawScratchEffect(context, cat, animation.elapsed);
    if (animation.visualReaction) this.drawReaction(context, cat, animation);
    context.restore();
  }

  drawSoftShadow(context, cat, sneaking, sprinting) {
    const x = Math.round(cat.x);
    const y = Math.round(cat.y + FOOT_OFFSET - 2);
    const radius = sneaking ? 10 : sprinting ? 14.5 : 13;
    context.save();
    context.translate(x, y);
    context.scale(1, 0.42);
    const gradient = context.createRadialGradient(0, 0, 1, 0, 0, radius);
    gradient.addColorStop(0, "rgba(24, 18, 15, 0.2)");
    gradient.addColorStop(0.68, "rgba(24, 18, 15, 0.09)");
    gradient.addColorStop(1, "rgba(24, 18, 15, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // Deterministic dust kicked up behind the cat while sprinting. It is drawn
  // from the animation clock rather than stored particles, so it can never
  // accumulate and costs only three rectangles per frame.
  drawSprintDust(context, cat, animation) {
    const cycle = animation.elapsed * 12;
    const forwardX = Math.sin(cat.facingAngle);
    const forwardY = -Math.cos(cat.facingAngle);
    const sideX = -forwardY;
    const sideY = forwardX;
    context.save();
    for (let index = 0; index < 3; index += 1) {
      const phase = (cycle * 0.34 + index * 0.31) % 1;
      const alpha = (1 - phase) * 0.2;
      if (alpha <= 0.01) continue;
      const back = 15 + phase * 20;
      const side = (index - 1) * 7;
      const x = Math.round(cat.x - forwardX * back + sideX * side);
      const y = Math.round(cat.y + FOOT_OFFSET - 3 - forwardY * back + sideY * side * 0.35 - phase * 2);
      context.fillStyle = `rgba(211, 183, 143, ${alpha.toFixed(3)})`;
      context.fillRect(x - 1, y - 1, 3, 2);
    }
    context.restore();
  }

  // Claw marks are placed in front of the cat along its actual facing vector,
  // so scratching furniture above, below or beside the cat all read correctly.
  drawScratchEffect(context, cat, elapsed) {
    const phase = (elapsed * 10) % 4;
    if (phase > 2.15) return;
    const intensity = phase < 0.45 ? phase / 0.45 : 1 - (phase - 0.45) / 1.7;
    const forwardX = Math.sin(cat.facingAngle);
    const forwardY = -Math.cos(cat.facingAngle);
    const sideX = -forwardY;
    const sideY = forwardX;
    const baseX = cat.x + forwardX * 25;
    const baseY = cat.y + forwardY * 25 - 2;
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, intensity));
    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * 4;
      const x = Math.round(baseX + sideX * offset);
      const y = Math.round(baseY + sideY * offset);
      context.fillStyle = index === 1 ? "#ffe6a0" : "#f3a75f";
      for (let step = 0; step < 3; step += 1) {
        context.fillRect(x + step - 1, y - step * 2, 2, 2);
      }
    }
    context.restore();
  }

  drawReaction(context, cat, animation) {
    const progress = Math.min(1, Math.max(0, animation.reactionProgress));
    const color = animation.visualReaction === "catch" ? "#ffe29a" : "#f2a65d";
    const pixels = [[-19,-12],[-12,-20],[14,-17],[20,-6],[-18,8],[16,10]];
    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.fillStyle = color;
    for (let index = 0; index < pixels.length; index += 1) {
      const [offsetX, offsetY] = pixels[index];
      const drift = Math.round(progress * (index % 2 ? 4 : -4));
      context.fillRect(Math.round(cat.x + offsetX + drift), Math.round(cat.y + offsetY - progress * 3), 3, 3);
    }
    context.restore();
  }
}
