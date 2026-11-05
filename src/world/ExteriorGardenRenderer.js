import {
  EXTERIOR_GARDEN_DECOR,
  EXTERIOR_GARDEN_PATHS,
  EXTERIOR_GARDEN_SPRITES,
} from "./ExteriorGardenData.js";

const GRASS_TILE_WORLD_SIZE = 220;
const SAFE_GAP = 12;

function intersects(a, b, gap = 0) {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y;
}

function drawStone(context, x, y, width, height, variant) {
  const left = Math.round(x);
  const top = Math.round(y);
  const w = Math.round(width);
  const h = Math.round(height);
  const colors = [
    { edge: "#514c3e", body: "#a99a78", light: "#d1c39a", shade: "#766d59" },
    { edge: "#4b493e", body: "#918b74", light: "#c0b899", shade: "#696653" },
    { edge: "#554b3d", body: "#b7a17b", light: "#d6c49d", shade: "#7a6c56" },
  ][variant % 3];

  context.fillStyle = "rgba(25, 24, 21, 0.38)";
  context.fillRect(left + 3, top + 4, w, h);
  context.fillStyle = colors.edge;
  context.fillRect(left + 1, top + 1, w - 2, h - 2);
  context.fillStyle = colors.body;
  context.fillRect(left + 3, top + 2, w - 6, h - 5);
  context.fillStyle = colors.light;
  context.fillRect(left + 4, top + 3, Math.max(3, Math.floor(w * 0.42)), 2);
  context.fillStyle = colors.shade;
  context.fillRect(left + Math.floor(w * 0.64), top + h - 5, Math.max(3, Math.floor(w * 0.22)), 2);
  context.fillStyle = "rgba(235, 220, 180, 0.45)";
  context.fillRect(left + Math.floor(w * 0.3), top + Math.floor(h * 0.48), 2, 2);
}

export class ExteriorGardenRenderer {
  constructor() {
    this.grassLoaded = false;
    this.atlasLoaded = false;
    this.grassPattern = null;
    this.atlas = null;

    this.grassImage = new Image();
    this.grassImage.onload = () => {
      this.prepareGrassPattern();
      this.grassLoaded = true;
      this.onLoad?.();
    };
    this.grassImage.onerror = () => console.error("Could not load exterior garden grass texture.");
    this.grassImage.src = new URL("../../assets/rooms/exterior-grass-tile.png", import.meta.url).href;

    this.atlasImage = new Image();
    this.atlasImage.onload = () => this.prepareAtlas();
    this.atlasImage.onerror = () => console.error("Could not load exterior garden sprite atlas.");
    this.atlasImage.src = new URL("../../assets/rooms/exterior-garden-atlas.png", import.meta.url).href;
  }

  prepareGrassPattern() {
    const tile = document.createElement("canvas");
    tile.width = GRASS_TILE_WORLD_SIZE;
    tile.height = GRASS_TILE_WORLD_SIZE;
    const tileContext = tile.getContext("2d");
    tileContext.imageSmoothingEnabled = false;
    tileContext.drawImage(this.grassImage, 0, 0, tile.width, tile.height);
    const context = document.createElement("canvas").getContext("2d");
    context.imageSmoothingEnabled = false;
    this.grassPattern = context.createPattern(tile, "repeat");
  }

  prepareAtlas() {
    this.atlas = document.createElement("canvas");
    this.atlas.width = this.atlasImage.naturalWidth;
    this.atlas.height = this.atlasImage.naturalHeight;
    const context = this.atlas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(this.atlasImage, 0, 0);

    // The generated transparent sheet contains a few isolated saturated red
    // edge artifacts. Remove only those pixels to keep its dark outlines intact.
    const pixels = context.getImageData(0, 0, this.atlas.width, this.atlas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index];
      const green = pixels.data[index + 1];
      const blue = pixels.data[index + 2];
      if (red > 220 && green < 70 && blue < 70) pixels.data[index + 3] = 0;
    }
    context.putImageData(pixels, 0, 0);
    this.atlasLoaded = true;
    this.onLoad?.();
  }

  draw(context, house) {
    context.fillStyle = "#3e5134";
    if (this.grassPattern) context.fillStyle = this.grassPattern;
    context.fillRect(0, 0, house.width, house.height);
    this.drawPaths(context);
    if (this.atlasLoaded) this.drawDecor(context, house);
  }

  drawPaths(context) {
    for (const path of EXTERIOR_GARDEN_PATHS) {
      const [first, ...rest] = path.points;
      let stoneIndex = 0;
      for (let segment = 0; segment < rest.length; segment += 1) {
        const start = segment === 0 ? first : path.points[segment];
        const end = rest[segment];
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const length = Math.hypot(dx, dy);
        const count = Math.max(1, Math.floor(length / path.spacing));
        const perpendicularX = length ? -dy / length : 0;
        const perpendicularY = length ? dx / length : 0;
        for (let index = 0; index <= count; index += 1) {
          const t = Math.min(1, index * path.spacing / Math.max(1, length));
          const centerX = start[0] + dx * t;
          const centerY = start[1] + dy * t;
          for (const lane of [-0.22, 0.22]) {
            const jitter = ((stoneIndex * 7 + segment * 3) % 9) - 4;
            const laneX = centerX + perpendicularX * path.width * lane;
            const laneY = centerY + perpendicularY * path.width * lane;
            const stoneWidth = path.width * (0.34 + (stoneIndex % 3) * 0.035);
            const stoneHeight = Math.max(15, path.width * 0.32);
            drawStone(context, laneX - stoneWidth / 2, laneY - stoneHeight / 2 + jitter, stoneWidth, stoneHeight, stoneIndex);
            stoneIndex += 1;
          }
        }
      }
    }
  }

  drawDecor(context, house) {
    const forbidden = [
      ...(house.walkableAreas ?? []),
      ...(house.walls ?? []),
    ];
    for (const placement of EXTERIOR_GARDEN_DECOR) {
      const sprite = EXTERIOR_GARDEN_SPRITES[placement.sprite];
      if (!sprite) continue;
      const width = sprite.width * placement.scale;
      const height = sprite.height * placement.scale;
      const bounds = {
        x: placement.x - width / 2,
        y: placement.y - height / 2,
        width,
        height,
      };
      if (forbidden.some((rect) => intersects(bounds, rect, SAFE_GAP))) continue;
      context.drawImage(
        this.atlas,
        sprite.x,
        sprite.y,
        sprite.width,
        sprite.height,
        Math.round(bounds.x),
        Math.round(bounds.y),
        Math.round(width),
        Math.round(height),
      );
    }
  }
}
