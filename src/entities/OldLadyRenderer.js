import { OLD_LADY_CONFIG } from "../systems/OldLadyConfig.js";

const STATE_COLORS = Object.freeze({
  SUSPICIOUS: "#f0c56f",
  SEARCHING: "#f1b56d",
  CHASING: "#f17c6d",
});

const SPRITE_ATLAS = "../../assets/characters/old-lady-frames.png";
const FRAME_COLUMNS = 12;
const FRAME_ROWS = 4;

export class OldLadyRenderer {
  constructor(config = OLD_LADY_CONFIG) {
    this.config = config;
    this.loaded = false;
    this.image = new Image();
    this.image.onload = () => {
      this.loaded = true;
      this.onLoad?.();
    };
    this.image.src = new URL(SPRITE_ATLAS, import.meta.url).href;
  }

  drawVision(context, lady, ai) {
    if (!this.config.debugVisionCone) return;
    const halfAngle = (this.config.visionAngleDegrees * Math.PI / 180) / 2;
    context.save();
    context.beginPath();
    context.moveTo(lady.x, lady.y);
    context.arc(lady.x, lady.y, this.config.visionDistance, lady.facingAngle - halfAngle, lady.facingAngle + halfAngle);
    context.closePath();
    context.fillStyle = ai.state === "CHASING" ? "rgba(207, 71, 58, 0.18)" : "rgba(242, 210, 128, 0.16)";
    context.fill();
    context.strokeStyle = "rgba(242, 210, 128, 0.38)";
    context.lineWidth = 3;
    context.stroke();
    context.restore();
  }

  draw(context, lady, ai, witnessMessage = "", witnessMessageAlpha = 1, capturePresentation = null, pose = null) {
    if (this.loaded && this.image.naturalWidth > 0) this.drawSprite(context, lady, pose);
    this.drawStateIndicator(context, lady, ai, capturePresentation, pose);
    if (witnessMessage) this.drawWitnessDialogue(context, lady, witnessMessage, witnessMessageAlpha);
  }

  drawWitnessDialogue(context, lady, message, opacity) {
    const boxWidth = 420;
    const left = Math.round(lady.x - boxWidth / 2);
    const top = Math.round(lady.y - 142);
    const textWidth = boxWidth - 34;
    const lines = [];
    context.save();
    context.font = "700 20px 'Segoe UI', sans-serif";
    for (const word of message.split(/\s+/)) {
      const lastIndex = lines.length - 1;
      const candidate = lastIndex >= 0 ? `${lines[lastIndex]} ${word}` : word;
      if (lastIndex < 0 || context.measureText(candidate).width > textWidth) lines.push(word);
      else lines[lastIndex] = candidate;
    }

    const lineHeight = 26;
    const boxHeight = Math.max(58, lines.length * lineHeight + 24);
    const bottom = top + boxHeight;
    context.globalAlpha = Math.max(0, Math.min(1, opacity));
    context.fillStyle = "rgba(33, 26, 31, 0.24)";
    context.fillRect(left + 5, top + 6, boxWidth, boxHeight);
    context.fillStyle = "#4b3544";
    context.fillRect(left - 3, top - 3, boxWidth + 6, boxHeight + 6);
    context.fillStyle = "#f4e8d4";
    context.fillRect(left, top, boxWidth, boxHeight);

    context.fillStyle = "#4b3544";
    context.beginPath();
    context.moveTo(lady.x - 11, bottom - 1);
    context.lineTo(lady.x + 12, bottom - 1);
    context.lineTo(lady.x + 3, bottom + 13);
    context.closePath();
    context.fill();
    context.fillStyle = "#f4e8d4";
    context.beginPath();
    context.moveTo(lady.x - 6, bottom - 1);
    context.lineTo(lady.x + 7, bottom - 1);
    context.lineTo(lady.x + 3, bottom + 8);
    context.closePath();
    context.fill();

    context.fillStyle = "#382c31";
    context.textAlign = "center";
    context.textBaseline = "middle";
    lines.forEach((line, index) => {
      context.fillText(line, lady.x, top + 12 + lineHeight * (index + 0.5), textWidth);
    });
    context.restore();
  }

  drawSprite(context, lady, pose = null) {
    const animation = lady.getAnimationState(this.config);
    const columnByMode = { idle: 0, walk: 4, run: 8 };
    const rowByDirection = { down: 0, left: 1, right: 2, up: 3 };
    const sourceWidth = this.image.naturalWidth / FRAME_COLUMNS;
    const sourceHeight = this.image.naturalHeight / FRAME_ROWS;
    const sourceX = (columnByMode[animation.mode] + animation.frameIndex) * sourceWidth;
    const direction = pose?.direction ?? animation.direction;
    const sourceY = rowByDirection[direction] * sourceHeight;
    const destinationWidth = sourceWidth * this.config.spriteScale;
    const destinationHeight = sourceHeight * this.config.spriteScale;
    const x = pose?.x ?? lady.x;
    const y = pose?.y ?? lady.y;

    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      this.image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      Math.round(x - destinationWidth / 2),
      Math.round(y - destinationHeight / 2),
      Math.round(destinationWidth),
      Math.round(destinationHeight),
    );
    context.restore();
  }

  drawStateIndicator(context, lady, ai, capturePresentation, pose = null) {
    const state = ai?.state;
    // Capture phases already have their own animation and should not show an AI icon.
    if (capturePresentation?.phase && capturePresentation.phase !== "game-over") return;
    if (state !== "SUSPICIOUS" && state !== "SEARCHING" && state !== "CHASING") return;

    const color = STATE_COLORS[state];
    const bounce = Math.sin((lady.animationTime ?? 0) * 5) * 1.5;
    const centerX = Math.round(pose?.x ?? lady.x);
    const centerY = Math.round((pose?.y ?? lady.y) - 51 + bounce);
    const isChasing = state === "CHASING";
    const radius = isChasing ? 15 : 13;

    context.save();
    context.fillStyle = "rgba(35, 29, 26, 0.94)";
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.beginPath();
    context.roundRect(centerX - radius, centerY - radius, radius * 2, radius * 2, isChasing ? 8 : 7);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.textAlign = "center";
    context.textBaseline = "middle";

    if (state === "SEARCHING") {
      // Compact magnifying glass with a small alert glint.
      context.beginPath();
      context.arc(centerX - 2, centerY - 2, 5, 0, Math.PI * 2);
      context.lineWidth = 2.5;
      context.stroke();
      context.beginPath();
      context.moveTo(centerX + 2, centerY + 2);
      context.lineTo(centerX + 7, centerY + 7);
      context.stroke();
      context.fillRect(centerX - 3, centerY - 3, 2, 2);
    } else {
      context.font = isChasing ? "900 21px Georgia, serif" : "900 20px Georgia, serif";
      context.fillText(isChasing ? "!" : "?", centerX, centerY + (isChasing ? 0 : -1));
    }
    context.restore();
  }
}
