import { getHouseFurnitureSpriteBounds } from "../world/FurnitureSpriteData.js";
import { getFurnitureVisualDamageStage } from "../world/FurnitureVisualData.js";

const ATTACK_SECONDS = 0.72;
const ATTACK_FRAMES = 12;
const PIXEL = 2;
const BROOM_CROP = Object.freeze({ x: 44, y: 85, width: 1700, height: 762 });
const SPRAYER_CROP = Object.freeze({ x: 65, y: 39, width: 1298, height: 1058 });

// Third-capture bathtub vignette. The room bath sprite is reused as the tub;
// only water, foam and a seated cat are drawn on top, then the sprite is
// re-drawn over the cat wherever the physical tub sits in front of it.
// Offsets are from the sprite's top-left corner and in world pixels.
const BATH = Object.freeze({
  seatFeetOffsetY: 68,
  waterCenterOffsetX: -4,
  waterCenterOffsetY: 48,
  waterRadiusX: 68,
  waterRadiusY: 11,
  frontWaterOffsetY: 44,
  nearRimOffsetY: 58,
});

const px = (context, x, y, width, height, color) => {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
};

const assetUrl = (file) => new URL(`../../assets/characters/${file}`, import.meta.url).href;

export class CaptureRenderer {
  constructor() {
    this.broom = this.loadSprite("grandma-broom.png");
    this.sprayer = this.loadSprite("grandma-water-sprayer.png");
  }

  loadSprite(file) {
    const image = new Image();
    image.onload = () => this.onLoad?.();
    image.src = assetUrl(file);
    return image;
  }

  draw(context, lady, cat, presentation, catRenderer = null, houseRenderer = null, house = null, furnitureSystem = null) {
    if (!presentation) return;
    const { kind, phase, elapsed = 0 } = presentation;
    context.save();
    if (phase === "punishment" && (kind === "broom" || kind === "sprayer")) {
      if (elapsed >= ATTACK_SECONDS) {
        context.restore();
        return;
      }
      const attack = this.getAttackFrame(elapsed);
      const angle = Math.atan2(cat.y - lady.y, cat.x - lady.x);
      if (kind === "broom") this.drawBroomAttack(context, lady, cat, angle, attack);
      else this.drawSprayerAttack(context, lady, cat, angle, attack);
    } else if (phase === "bath-arrival" || phase === "game-over") {
      this.drawBathScene(context, cat, catRenderer, elapsed, houseRenderer, house, furnitureSystem);
    }
    context.restore();
  }

  // Seated cat inside the room's own bathtub sprite. The water sits in the
  // sprite's basin; the cat is drawn between the back and front halves of the
  // water, then the sprite's near rim is re-drawn over the cat's lower body.
  // The taps stay behind the water surface.
  drawBathScene(context, cat, catRenderer, elapsed, houseRenderer, house, furnitureSystem) {
    const bath = house?.furniture?.find((item) => item.id === "bath") ?? null;
    const bounds = bath ? getHouseFurnitureSpriteBounds(bath) : null;
    const centerX = bounds ? bounds.x + bounds.width / 2 : Math.round(cat.x);
    const top = bounds ? bounds.y : Math.round(cat.y) + 24;
    const waterX = centerX + BATH.waterCenterOffsetX;
    const waterY = top + BATH.waterCenterOffsetY;
    const feetY = top + BATH.seatFeetOffsetY;
    const damageStage = getFurnitureVisualDamageStage(furnitureSystem?.getState?.("bath"));
    const drawSeatedCat = (clip = null) => {
      if (!catRenderer) return;
      context.save();
      if (clip) {
        context.beginPath();
        context.rect(clip.x, clip.y, clip.width, clip.height);
        context.clip();
      }
      context.translate(centerX - cat.x, feetY - (cat.y + 34));
      catRenderer.draw(context, cat, { facing: "down", shadow: false });
      context.restore();
    };

    context.save();
    context.imageSmoothingEnabled = false;

    // Water surface behind the cat plus the far foam fringe.
    this.drawBathWater(context, waterX, waterY);
    this.drawBathFarFoam(context, waterX, waterY);

    // Seated, front-facing cat. The standing world cat is skipped for these
    // phases so there is exactly one cat and it lands inside the basin.
    drawSeatedCat();

    // Near half of the water hides the cat's chest below the waterline.
    this.drawBathFrontWater(context, waterX, top, waterY);
    this.drawBathCollar(context, waterX, waterY);
    this.drawBathRipples(context, waterX, waterY, elapsed);

    // Put the physical tub back in front of the cat.
    if (bath && houseRenderer) {
      this.drawBathSpriteOverlays(context, bounds, bath, houseRenderer, damageStage);
    }

    // Foam ridge along the near rim, then the cat's paws resting on it.
    this.drawBathNearFoam(context, waterX, waterY, elapsed);
    drawSeatedCat({ x: centerX - 26, y: feetY - 13, width: 52, height: 13 });
    this.drawBathPawFoam(context, centerX, feetY);

    this.drawBathBubbles(context, waterX, waterY, elapsed);
    this.drawBathSplashes(context, waterX, waterY, elapsed);
    this.drawBathExpression(context, centerX, feetY, elapsed);

    context.restore();
  }

  drawBathSpriteOverlays(context, bounds, item, houseRenderer, damageStage) {
    // Only the near rim needs to sit in front of the cat. The towel hangs on
    // that rim and is included; the taps stay behind the water surface.
    context.save();
    context.beginPath();
    context.rect(bounds.x - 8, bounds.y + BATH.nearRimOffsetY, bounds.width + 16, bounds.height - BATH.nearRimOffsetY + 12);
    context.clip();
    houseRenderer.housePropsRenderer.drawFurnitureSprite(context, item, damageStage);
    context.restore();
  }

  // Chunky 2px-band ellipse keeps the water pixel-aligned instead of relying
  // on the canvas anti-aliased ellipse path.
  fillPixelEllipse(context, cx, cy, rx, ry, color) {
    context.fillStyle = color;
    for (let y = -ry; y < ry; y += 2) {
      const t = (y + 1) / ry;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
      if (half > 0) context.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 2);
    }
  }

  drawBathWater(context, cx, cy) {
    // Darker base and a lighter surface shifted toward the near edge give the
    // flat pixel ellipse a readable sense of depth.
    this.fillPixelEllipse(context, cx, cy, BATH.waterRadiusX, BATH.waterRadiusY, "#3c6c76");
    this.fillPixelEllipse(context, cx, cy - 1, BATH.waterRadiusX - 3, BATH.waterRadiusY - 2, "#54868f");
    this.fillPixelEllipse(context, cx, cy + 2, BATH.waterRadiusX - 8, BATH.waterRadiusY - 4, "#7fb2b1");
    this.fillPixelEllipse(context, cx, cy + 3, BATH.waterRadiusX - 17, BATH.waterRadiusY - 6, "#a6d2ca");
    const waves = [
      [-46, -4, 10, "rgba(190, 226, 220, 0.45)"],
      [-22, -1, 7, "rgba(226, 247, 242, 0.5)"],
      [6, -5, 12, "rgba(190, 226, 220, 0.45)"],
      [28, 0, 6, "rgba(226, 247, 242, 0.5)"],
      [44, 3, 9, "rgba(69, 115, 124, 0.35)"],
    ];
    for (const [dx, dy, width, color] of waves) {
      px(context, cx + dx, cy + dy, width, 1, color);
    }
  }

  drawBathFrontWater(context, cx, top, waterY) {
    const waterline = top + BATH.frontWaterOffsetY;
    context.save();
    context.beginPath();
    context.rect(
      cx - BATH.waterRadiusX - 2,
      waterline,
      (BATH.waterRadiusX + 2) * 2,
      waterY + BATH.waterRadiusY + 4 - waterline,
    );
    context.clip();
    this.drawBathWater(context, cx, waterY);
    context.restore();
  }

  drawBathFarFoam(context, cx, waterY) {
    const blobs = [
      [-40, -8, 10, 4], [-27, -9, 11, 5], [16, -9, 11, 5], [29, -8, 10, 4], [44, -6, 9, 4],
    ];
    for (const [dx, dy, width, height] of blobs) {
      this.drawFoamBlob(context, cx + dx, waterY + dy, width, height);
    }
  }

  // Foam ring where the cat meets the water, so the waterline is not a hard cut.
  drawBathCollar(context, cx, waterY) {
    const blobs = [
      [-29, 0, 10, 4], [-20, -1, 12, 5], [-9, -2, 12, 5],
      [3, -2, 12, 5], [14, -1, 12, 5], [25, 0, 10, 4],
    ];
    for (const [dx, dy, width, height] of blobs) {
      this.drawFoamBlob(context, cx + dx, waterY - 3 + dy, width, height);
    }
  }

  drawBathNearFoam(context, cx, waterY, elapsed) {
    const blobs = [
      [-65, 5, 11, 5], [-54, 7, 13, 6], [-43, 8, 11, 5], [-31, 8, 13, 6],
      [-18, 9, 11, 5], [-6, 9, 13, 5], [7, 9, 11, 5], [20, 8, 13, 6],
      [33, 8, 11, 5], [45, 7, 13, 6], [57, 6, 11, 5], [68, 4, 9, 4],
    ];
    for (const [dx, dy, width, height] of blobs) {
      this.drawFoamBlob(context, cx + dx, waterY + dy, width, height);
    }
    // A couple of slow-drifting flecks keep the surface alive.
    for (let index = 0; index < 3; index += 1) {
      const drift = Math.sin(elapsed * 1.6 + index * 1.7) * 5;
      px(context, cx - 34 + index * 30 + drift, waterY + 7, 3, 2, "#f2fbf7");
    }
  }

  drawFoamBlob(context, x, y, width, height) {
    const left = x - width / 2;
    const top = y - height / 2;
    px(context, left + 2, top, width - 4, 2, "#f6fefb");
    px(context, left, top + 1, width, Math.max(2, height - 2), "#e6f5ef");
    px(context, left + 2, top + height - 2, width - 4, 2, "#cbe6df");
    px(context, left + 3, top + 1, Math.max(3, width * 0.3), 2, "#ffffff");
  }

  drawBathPawFoam(context, cx, feetY) {
    this.drawFoamBlob(context, cx - 11, feetY - 3, 12, 5);
    this.drawFoamBlob(context, cx + 11, feetY - 3, 12, 5);
  }

  drawBathRipples(context, cx, cy, elapsed) {
    const dashes = [[-54, 0, 10], [-38, 2, 7], [23, 1, 11], [40, 3, 7]];
    for (let index = 0; index < dashes.length; index += 1) {
      const [dx, dy, width] = dashes[index];
      const shift = ((Math.floor(elapsed * 6) + index * 2) % 6) - 3;
      px(context, cx + dx + shift, cy + dy + 2, width, 1, "rgba(226, 248, 243, 0.55)");
    }
  }

  drawBathBubbles(context, cx, cy, elapsed) {
    const bubbles = [
      [-58, 4, 4, 0], [-45, 6, 5, 1], [-32, 3, 3, 2],
      [33, 4, 3, 3], [47, 7, 5, 4], [61, 4, 4, 5],
      [-20, 9, 3, 6], [22, 9, 3, 7],
    ];
    for (const [dx, dy, size, phase] of bubbles) {
      const rise = (elapsed * 10 + phase * 3) % 12;
      this.drawBubble(context, cx + dx, cy + dy - rise, size);
    }
    // Two soap bubbles drifting above the water near the sides.
    const float = Math.sin(elapsed * 2.2);
    this.drawBubble(context, cx - 40, cy - 10 + Math.round(float * 2), 5);
    this.drawBubble(context, cx + 38, cy - 13 - Math.round(float * 2), 4);
  }

  drawBubble(context, x, y, size) {
    const s = Math.max(3, Math.round(size));
    const left = Math.round(x - s / 2);
    const top = Math.round(y - s / 2);
    const edge = s >= 5 ? 2 : 1;
    const color = "rgba(214, 244, 240, 0.9)";
    px(context, left, top, s, edge, color);
    px(context, left, top, edge, s, color);
    px(context, left + s - edge, top, edge, s, color);
    px(context, left, top + s - edge, s, edge, color);
    px(context, left + 1, top + 1, 1, 1, "rgba(255, 255, 255, 0.95)");
  }

  drawBathSplashes(context, cx, cy, elapsed) {
    const drops = [[-64, 0, 0], [-56, -4, 1], [54, -2, 2], [63, 2, 3]];
    for (const [dx, dy, phase] of drops) {
      const bob = Math.round(Math.sin(elapsed * 6 + phase * 1.7) * 2);
      const x = cx + dx;
      const y = cy + dy + bob;
      px(context, x, y, 2, 3, "rgba(196, 236, 232, 0.9)");
      px(context, x, y, 1, 2, "#f0fdfa");
    }
    px(context, cx - 50, cy - 7 + Math.round(Math.sin(elapsed * 5)), 4, 1, "rgba(220, 248, 243, 0.8)");
    px(context, cx + 46, cy - 8 + Math.round(Math.cos(elapsed * 5)), 4, 1, "rgba(220, 248, 243, 0.8)");
  }

  // Unhappy, embarrassed expression layered over the seated cat's face. The
  // idle front frame is fixed, so these offsets stay stable.
  drawBathExpression(context, cx, feetY, elapsed) {
    const eyeY = Math.round(feetY - 48.5);
    const mouthY = Math.round(feetY - 41);
    // Sad brows: inner ends raised.
    px(context, cx - 10, eyeY - 2, 3, 2, "#5d3424");
    px(context, cx - 8, eyeY - 3, 3, 2, "#5d3424");
    px(context, cx - 6, eyeY - 4, 3, 2, "#5d3424");
    px(context, cx + 4, eyeY - 4, 3, 2, "#5d3424");
    px(context, cx + 6, eyeY - 3, 3, 2, "#5d3424");
    px(context, cx + 8, eyeY - 2, 3, 2, "#5d3424");
    // Embarrassed blush on both cheeks.
    px(context, cx - 14, eyeY + 5, 6, 2, "rgba(232, 96, 88, 0.5)");
    px(context, cx + 8, eyeY + 5, 6, 2, "rgba(232, 96, 88, 0.5)");
    px(context, cx - 13, eyeY + 6, 3, 1, "rgba(198, 60, 58, 0.6)");
    px(context, cx + 11, eyeY + 6, 3, 1, "rgba(198, 60, 58, 0.6)");
    // Downturned mouth.
    px(context, cx - 5, mouthY + 2, 3, 1, "#4b2a1d");
    px(context, cx - 2, mouthY, 5, 1, "#4b2a1d");
    px(context, cx + 3, mouthY + 2, 3, 1, "#4b2a1d");
    // Sweat drop by the right ear.
    const dropY = Math.round(feetY - 58 + Math.sin(elapsed * 3));
    px(context, cx + 17, dropY, 2, 2, "#8fd3e6");
    px(context, cx + 17, dropY + 2, 1, 2, "#8fd3e6");
    px(context, cx + 17, dropY, 1, 1, "#eafbff");
  }


  getAttackFrame(elapsed) {
    const frame = Math.min(ATTACK_FRAMES - 1, Math.floor(Math.max(0, elapsed) / ATTACK_SECONDS * ATTACK_FRAMES));
    return { index: frame, time: Math.min(1, Math.max(0, elapsed) / ATTACK_SECONDS) };
  }

  drawBroomAttack(context, lady, cat, angle, attack) {
    const { index, time } = attack;
    const phase = index < 3 ? "anticipation" : index < 6 ? "windup" : index < 9 ? "swing" : "recovery";
    const progress = index % 3;
    const armReach = phase === "anticipation" ? 6 + progress * 2
      : phase === "windup" ? 13 + progress * 2
        : phase === "swing" ? 18 - progress * 3
          : 10 - progress * 2;
    const armAngle = angle + (phase === "anticipation" ? -0.55 : phase === "windup" ? -1.05 : phase === "swing" ? 0.52 + progress * 0.17 : 0.08);
    const handX = lady.x + Math.cos(angle) * 11;
    const handY = lady.y + Math.sin(angle) * 7 - 4;

    this.drawPixelArm(context, lady, handX, handY, armAngle, armReach);
    if (this.broom.complete && this.broom.naturalWidth > 0) {
      context.save();
      context.translate(handX, handY);
      context.rotate(armAngle + Math.PI);
      const raise = phase === "anticipation" ? 0.72 + progress * 0.12 : phase === "windup" ? 1.06 : 1;
      const swingOffset = phase === "swing" ? progress * 5 : 0;
      const width = 48 * raise;
      const height = width * BROOM_CROP.height / BROOM_CROP.width;
      context.imageSmoothingEnabled = false;
      context.drawImage(this.broom, BROOM_CROP.x, BROOM_CROP.y, BROOM_CROP.width, BROOM_CROP.height,
        -width + swingOffset, -height / 2, width, height);
      context.restore();
    }

    if (phase === "swing") {
      this.drawSwingArc(context, lady, angle, progress);
      if (progress >= 1) this.drawDustImpact(context, cat, time);
    }
  }

  drawSprayerAttack(context, lady, cat, angle, attack) {
    const { index, time } = attack;
    const phase = index < 3 ? "anticipation" : index < 6 ? "aim" : index < 9 ? "spray" : "recovery";
    const progress = index % 3;
    const handX = lady.x + Math.cos(angle) * (phase === "aim" || phase === "spray" ? 15 : 10);
    const handY = lady.y + Math.sin(angle) * 8 - (phase === "aim" || phase === "spray" ? 4 : 0);
    const armAngle = angle + (phase === "anticipation" ? -0.32 : phase === "recovery" ? -0.1 : 0);
    this.drawPixelArm(context, lady, handX, handY, armAngle, phase === "spray" ? 15 : 10);

    if (this.sprayer.complete && this.sprayer.naturalWidth > 0) {
      context.save();
      context.translate(handX, handY);
      context.rotate(angle);
      const raise = phase === "anticipation" ? 0.68 + progress * 0.16 : phase === "recovery" ? 1 - progress * 0.12 : 1;
      const width = 18 * raise;
      const height = width * SPRAYER_CROP.height / SPRAYER_CROP.width;
      context.imageSmoothingEnabled = false;
      context.drawImage(this.sprayer, SPRAYER_CROP.x, SPRAYER_CROP.y, SPRAYER_CROP.width, SPRAYER_CROP.height,
        -width / 2, -height / 2, width, height);
      context.restore();
    }
    if (phase === "spray") this.drawWaterStream(context, handX, handY, cat, time, progress);
  }

  drawPixelArm(context, lady, handX, handY, angle, reach) {
    context.save();
    context.translate(lady.x, lady.y - 3);
    context.rotate(angle);
    context.fillStyle = "#382536";
    context.fillRect(3, -4, reach + 2, 10);
    context.fillStyle = "#75435f";
    context.fillRect(5, -3, Math.max(3, reach - 1), 7);
    context.fillStyle = "#e8a57c";
    context.fillRect(reach + 2, -2, 6, 7);
    context.restore();
  }

  drawSwingArc(context, lady, angle, progress) {
    const radius = 34 + progress * 5;
    context.save();
    context.translate(lady.x, lady.y);
    context.rotate(angle);
    context.strokeStyle = "rgba(244, 207, 150, 0.9)";
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, radius, -1.05, 0.38 + progress * 0.28);
    context.stroke();
    context.fillStyle = "#f4d9a3";
    for (let i = 0; i < 3; i += 1) {
      const x = radius * Math.cos(-0.48 + i * 0.38);
      const y = radius * Math.sin(-0.48 + i * 0.38);
      context.fillRect(Math.round(x / PIXEL) * PIXEL, Math.round(y / PIXEL) * PIXEL, PIXEL * 2, PIXEL * 2);
    }
    context.restore();
  }

  drawDustImpact(context, cat, time) {
    const alpha = Math.max(0.15, Math.min(1, 1 - Math.max(0, time - 0.625) * 4));
    context.save();
    context.globalAlpha = alpha;
    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI / 3;
      const distance = 17 + (i % 3) * 6;
      const x = cat.x + Math.cos(angle) * distance;
      const y = cat.y + Math.sin(angle) * distance * 0.7;
      context.fillStyle = i % 2 ? "#d9b17b" : "#f5d7a3";
      context.fillRect(Math.round(x / PIXEL) * PIXEL, Math.round(y / PIXEL) * PIXEL, PIXEL * (i % 2 ? 2 : 3), PIXEL * 2);
    }
    context.fillStyle = "rgba(255, 243, 208, 0.28)";
    context.beginPath();
    context.arc(cat.x, cat.y, 21, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  drawWaterStream(context, handX, handY, cat, time, progress) {
    const dx = cat.x - handX;
    const dy = cat.y - handY;
    const length = Math.hypot(dx, dy) || 1;
    const nx = dx / length;
    const ny = dy / length;
    const reach = Math.min(length - 10, 45 + progress * 13);
    context.save();
    context.lineCap = "square";
    context.strokeStyle = "rgba(123, 206, 236, 0.86)";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(handX + nx * 8, handY + ny * 8);
    context.lineTo(handX + nx * reach, handY + ny * reach);
    context.stroke();
    context.strokeStyle = "rgba(220, 248, 255, 0.92)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(handX + nx * 11, handY + ny * 11);
    context.lineTo(handX + nx * (reach - 4), handY + ny * (reach - 4));
    context.stroke();
    for (let i = 0; i < 7; i += 1) {
      const along = 13 + ((i * 17 + Math.floor(time * 42)) % Math.max(18, Math.floor(reach - 10)));
      const spread = ((i % 3) - 1) * (4 + progress * 3);
      const x = handX + nx * along - ny * spread;
      const y = handY + ny * along + nx * spread;
      context.fillStyle = i % 2 ? "#86d7f1" : "#d5f5ff";
      context.fillRect(Math.round(x / PIXEL) * PIXEL, Math.round(y / PIXEL) * PIXEL, PIXEL * (i % 3 === 0 ? 2 : 1), PIXEL);
    }
    if (reach >= length - 10) this.drawSplash(context, cat.x, cat.y, time);
    context.restore();
  }

  drawSplash(context, x, y, time) {
    for (let i = 0; i < 5; i += 1) {
      const phase = (time * 13 + i * 0.21) % 1;
      const angle = i * Math.PI * 0.4;
      const radius = 5 + phase * 13;
      context.fillStyle = `rgba(188, 235, 250, ${1 - phase})`;
      context.fillRect(Math.round((x + Math.cos(angle) * radius) / PIXEL) * PIXEL, Math.round((y + Math.sin(angle) * radius) / PIXEL) * PIXEL, PIXEL * 2, PIXEL * 2);
    }
  }
}
