import { LIVING_ROOM_DECOR } from "./LivingRoomDecor.js";
import { getFurnitureDamageFilter } from "./FurnitureVisualData.js";

const FLOOR_TILE_WORLD_SIZE = 156;

// Independently measured opaque sprite bounds from the generated 1254 × 1254 atlas.
const SPRITES = Object.freeze({
  sofa: { x: 20, y: 405, width: 346, height: 244 },
  armchair: { x: 374, y: 394, width: 241, height: 270 },
  rug: { x: 637, y: 393, width: 302, height: 271 },
  coffeeTable: { x: 962, y: 437, width: 272, height: 221 },
  plant: { x: 37, y: 663, width: 287, height: 313 },
  yarn: { x: 718, y: 1058, width: 186, height: 151 },
});

function pixelRect(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function drawInsetOutline(context, item, color = "#38261d", width = 3) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.strokeRect(item.x + width / 2, item.y + width / 2, item.width - width, item.height - width);
}

export class LivingRoomRenderer {
  constructor() {
    this.floorImage = new Image();
    this.floorLoaded = false;
    this.floorImage.onload = () => {
      this.floorLoaded = true;
      this.onLoad?.();
    };
    this.floorImage.onerror = () => console.error("Could not load living-room floor texture.");
    this.floorImage.src = new URL("../../assets/rooms/living-room-floor.png", import.meta.url).href;

    this.kitchenTileImage = new Image();
    this.kitchenTileLoaded = false;
    this.kitchenTileImage.onload = () => { this.kitchenTileLoaded = true; this.onLoad?.(); };
    this.kitchenTileImage.onerror = () => console.error("Could not load kitchen tile texture.");
    this.kitchenTileImage.src = new URL("../../assets/rooms/kitchen-tile.png", import.meta.url).href;

    this.bathroomTileImage = new Image();
    this.bathroomTileLoaded = false;
    this.bathroomTileImage.onload = () => { this.bathroomTileLoaded = true; this.onLoad?.(); };
    this.bathroomTileImage.onerror = () => console.error("Could not load bathroom tile texture.");
    this.bathroomTileImage.src = new URL("../../assets/rooms/bathroom-tile.png", import.meta.url).href;

    this.atlasImage = new Image();
    this.atlasLoaded = false;
    this.atlasImage.onload = () => this.prepareAtlas();
    this.atlasImage.onerror = () => console.error("Could not load living-room prop atlas.");
    this.atlasImage.src = new URL("../../assets/rooms/living-room-props.png", import.meta.url).href;

    // The rug is built from many individual primitives. Canvas filters are
    // applied to every draw operation, so filtering that geometry each frame
    // is far more expensive than filtering a single cached bitmap.
    this.rugStageCache = new Map();
  }

  prepareAtlas() {
    if (this.atlasImage.naturalWidth !== 1254 || this.atlasImage.naturalHeight !== 1254) {
      console.error(`Unexpected living-room atlas dimensions: ${this.atlasImage.naturalWidth} × ${this.atlasImage.naturalHeight}`);
      return;
    }
    this.atlas = document.createElement("canvas");
    this.atlas.width = this.atlasImage.naturalWidth;
    this.atlas.height = this.atlasImage.naturalHeight;
    const context = this.atlas.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = false;
    context.drawImage(this.atlasImage, 0, 0);

    // The generated atlas has a small, saturated red fringe on some outer edges.
    // Remove only those isolated bright-red pixels; preserve warm fur, fire, wood and outlines.
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

  drawFloor(context, rect) {
    const kitchen = rect.id === "kitchen" || rect.id === "pantry" || rect.id === "kitchen-connector" || rect.id === "kitchen-pantry-link";
    const bathroom = rect.id === "bathroom" || rect.id === "bathroom-connector" || rect.id === "bedroom-bathroom-link" || rect.id === "bathroom-storage-link";
    const image = kitchen ? this.kitchenTileImage : bathroom ? this.bathroomTileImage : this.floorImage;
    const loaded = kitchen ? this.kitchenTileLoaded : bathroom ? this.bathroomTileLoaded : this.floorLoaded;
    if (!loaded || !image) return false;
    context.save();
    context.beginPath();
    context.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip();
    context.imageSmoothingEnabled = false;
    const size = FLOOR_TILE_WORLD_SIZE;
    const firstX = Math.floor(rect.x / size) * size;
    const firstY = Math.floor(rect.y / size) * size;
    for (let y = firstY; y < rect.y + rect.height; y += size) {
      for (let x = firstX; x < rect.x + rect.width; x += size) {
        context.drawImage(image, x, y, size, size);
      }
    }
    context.restore();
    return true;
  }

  drawFurniture(context, item, damageStage = 0) {
    if (!["sofa", "armchair", "living-rug", "coffee-table", "tv-cabinet"].includes(item.id)) return false;
    if (item.id === "living-rug") return this.drawCachedRug(context, item, damageStage);
    context.save();
    context.imageSmoothingEnabled = false;
    const shadowY = item.y + item.height - 4;
    pixelRect(context, item.x + 7, shadowY, item.width - 14, 15, "rgba(35, 24, 23, 0.32)");
    context.filter = getFurnitureDamageFilter(damageStage);
    switch (item.id) {
      case "sofa": this.drawSofa(context, item); break;
      case "armchair": this.drawArmchair(context, item); break;
      case "coffee-table": this.drawCoffeeTable(context, item); break;
      case "tv-cabinet": this.drawCabinet(context, item); break;
    }
    context.restore();
    return true;
  }

  drawCachedRug(context, item, damageStage) {
    // Cache at the current device scale so the filtered bitmap is displayed
    // one-to-one and keeps the same antialiasing as the direct draw path.
    const scale = Math.abs(context.getTransform?.().a) || 1;
    const margin = 16;
    const x = item.x - margin;
    const y = item.y - margin;
    const key = `${item.x}:${item.y}:${item.width}:${item.height}:${damageStage}:${scale.toFixed(3)}`;
    let cached = this.rugStageCache.get(key);
    if (!cached) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil((item.width + margin * 2) * scale));
      canvas.height = Math.max(1, Math.ceil((item.height + margin * 2) * scale));
      const cacheContext = canvas.getContext("2d");
      cacheContext.imageSmoothingEnabled = false;
      cacheContext.setTransform(scale, 0, 0, scale, -x * scale, -y * scale);
      pixelRect(cacheContext, item.x + 7, item.y + item.height - 3, item.width - 14, 7, "rgba(35, 24, 23, 0.32)");
      cacheContext.filter = getFurnitureDamageFilter(damageStage);
      this.drawRug(cacheContext, item);
      cached = { canvas, x, y, scale };
      this.rugStageCache.set(key, cached);
    }
    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(cached.canvas, cached.x, cached.y,
      cached.canvas.width / cached.scale, cached.canvas.height / cached.scale);
    context.restore();
    return true;
  }

  drawSofa(context, item) {
    const { x, y, width: w, height: h } = item;
    if (this.atlasLoaded) this.drawSprite(context, "sofa", x - 4, y - 8, w + 8, h + 34);
    else this.drawFallbackSofa(context, item);
  }

  drawArmchair(context, item) {
    const { x, y, width: w, height: h } = item;
    const left = x - 3;
    const top = y - 6;
    const width = w + 6;
    const height = h + 18;
    pixelRect(context, left + 6, top + 11, width - 12, height - 12, "#39232c");
    pixelRect(context, left + 10, top + 7, width - 20, Math.round(height * 0.39), "#743a42");
    pixelRect(context, left + 14, top + 11, width - 28, Math.round(height * 0.31), "#a95a58");
    pixelRect(context, left + 16, top + 15, width - 32, 4, "#d08a75");
    pixelRect(context, left + 12, top + Math.round(height * 0.47), width - 24, Math.round(height * 0.35), "#bb6b61");
    pixelRect(context, left + 5, top + 24, 15, height - 44, "#5a3036");
    pixelRect(context, left + width - 20, top + 24, 15, height - 44, "#5a3036");
    pixelRect(context, left + 9, top + 25, 6, height - 47, "#bf7065");
    pixelRect(context, left + width - 15, top + 25, 6, height - 47, "#bf7065");
    // A small embroidered cushion keeps the chair identity clear at game scale.
    const cushionX = left + Math.round(width * 0.38);
    const cushionY = top + Math.round(height * 0.53);
    pixelRect(context, cushionX, cushionY, 28, 22, "#e5c69b");
    pixelRect(context, cushionX + 7, cushionY + 5, 14, 12, "#a74745");
    pixelRect(context, cushionX + 12, cushionY + 2, 4, 18, "#d28c64");
    pixelRect(context, cushionX + 5, cushionY + 9, 18, 4, "#d28c64");
    drawInsetOutline(context, { x: left, y: top, width, height }, "#2e2027", 4);
    drawInsetOutline(context, item);
  }

  drawRug(context, item) {
    const { x, y, width: w, height: h } = item;
    pixelRect(context, x + 3, y + 4, w - 6, h - 8, "#442b32");
    pixelRect(context, x + 8, y + 8, w - 16, h - 16, "#9b483f");
    pixelRect(context, x + 13, y + 13, w - 26, h - 26, "#6b3034");
    pixelRect(context, x + 18, y + 18, w - 36, h - 36, "#8f4039");
    pixelRect(context, x + 22, y + 22, w - 44, h - 44, "#75403a");
    pixelRect(context, x + 26, y + 26, w - 52, h - 52, "#8c463a");
    context.strokeStyle = "#e2bf82";
    context.lineWidth = 2;
    context.strokeRect(x + 11, y + 11, w - 22, h - 22);
    context.strokeRect(x + 20, y + 20, w - 40, h - 40);
    const flower = (cx, cy, scale = 1) => {
      const petal = Math.max(3, Math.round(4 * scale));
      const gap = Math.max(2, Math.round(3 * scale));
      for (const [dx, dy] of [[0, -gap], [gap, 0], [0, gap], [-gap, 0], [gap, -gap], [-gap, -gap]]) {
        pixelRect(context, cx + dx - petal / 2, cy + dy - petal / 2, petal, petal, "#d78a4f");
      }
      pixelRect(context, cx - 2, cy - 2, 4, 4, "#e8c276");
    };
    const rowCount = Math.max(4, Math.floor((w - 60) / 35));
    for (let index = 0; index < rowCount; index += 1) {
      const cx = Math.round(x + 32 + index * ((w - 64) / Math.max(1, rowCount - 1)));
      flower(cx, y + 11, 0.8);
      flower(cx, y + h - 11, 0.8);
    }
    for (const cy of [y + 38, y + h - 38]) {
      flower(x + 12, cy, 0.8);
      flower(x + w - 12, cy, 0.8);
    }
    const centerX = Math.round(x + w / 2);
    const centerY = Math.round(y + h / 2);
    pixelRect(context, centerX - 14, centerY - 14, 28, 28, "#d58a52");
    pixelRect(context, centerX - 9, centerY - 9, 18, 18, "#6b3034");
    flower(centerX, centerY, 1.35);
    for (const [dx, dy] of [[0, -27], [27, 0], [0, 27], [-27, 0]]) flower(centerX + dx, centerY + dy);
    // Tiny woven flecks keep the broad field from reading as a flat fill.
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const px = x + 55 + column * Math.floor((w - 110) / 7);
        const py = y + 39 + row * Math.floor((h - 78) / 2);
        if (Math.abs(px - centerX) > 34 || Math.abs(py - centerY) > 26) {
          pixelRect(context, px, py, 3, 2, row % 2 ? "#b86b49" : "#d6a667");
        }
      }
    }
    drawInsetOutline(context, item);
  }

  drawCoffeeTable(context, item) {
    const { x, y, width: w, height: h } = item;
    if (this.atlasLoaded) this.drawSprite(context, "coffeeTable", x - 8, y - 24, w + 16, h + 34);
    else this.drawFallbackCoffeeTable(context, item);
  }

  drawCabinet(context, item) {
    const { x, y, width: w, height: h } = item;
    const left = x - 5;
    const top = y - 6;
    const width = w + 10;
    const height = h + 18;
    pixelRect(context, left + 8, top + 8, width - 16, height - 18, "#3a2927");
    pixelRect(context, left + 12, top + 5, width - 24, 15, "#b27a46");
    pixelRect(context, left + 15, top + 7, width - 30, 8, "#d4a15d");
    pixelRect(context, left + 12, top + 21, width - 24, height - 37, "#6a412e");
    pixelRect(context, left + 16, top + 24, width - 32, height - 44, "#8f5b36");
    // Framed television and a little cabinet storage on the same wood body.
    pixelRect(context, left + 20, top + 26, Math.round(width * 0.58), Math.round(height * 0.48), "#2d2d30");
    pixelRect(context, left + 24, top + 30, Math.round(width * 0.58) - 8, Math.round(height * 0.48) - 8, "#52636a");
    pixelRect(context, left + 28, top + 34, Math.round(width * 0.58) - 18, 3, "#8ba0a1");
    pixelRect(context, left + Math.round(width * 0.72), top + 27, 3, height - 47, "#573823");
    pixelRect(context, left + Math.round(width * 0.82), top + 36, 5, 5, "#e4bd68");
    pixelRect(context, left + Math.round(width * 0.79), top + 56, 12, 2, "#bc8750");
    pixelRect(context, left + 15, top + height - 17, width - 30, 5, "#4d3025");
    pixelRect(context, left + 22, top + height - 12, 7, 8, "#39251f");
    pixelRect(context, left + width - 29, top + height - 12, 7, 8, "#39251f");
    drawInsetOutline(context, { x: left, y: top, width, height }, "#2c2020", 4);
  }

  drawFallbackSofa(context, item) {
    const { x, y, width: w, height: h } = item;
    pixelRect(context, x + 2, y + 4, w - 4, h + 24, "#34432c");
    pixelRect(context, x + 9, y + 8, w - 18, h + 7, "#657440");
    pixelRect(context, x + 14, y + 18, w - 28, h - 3, "#899455");
    drawInsetOutline(context, item);
  }

  drawFallbackCoffeeTable(context, item) {
    const { x, y, width: w, height: h } = item;
    pixelRect(context, x + 8, y + 5, w - 16, h + 14, "#573823");
    pixelRect(context, x + 13, y + 2, w - 26, h - 4, "#a26a3c");
    pixelRect(context, x + 17, y + 6, w - 34, h - 14, "#c38b4b");
    drawInsetOutline(context, item);
  }

  drawSprite(context, name, x, y, width, height) {
    const sprite = SPRITES[name];
    if (!sprite || !this.atlasLoaded) return false;
    context.drawImage(this.atlas, sprite.x, sprite.y, sprite.width, sprite.height, Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    return true;
  }

  drawRoomDetails(context, house, room) {
    if (room.id !== "living-room") return;
    this.drawRoomTrim(context, house, room);
  }

  drawFloorDecor(context, decor) {
    if (decor.layer !== "floor") return;
    context.save();
    context.imageSmoothingEnabled = false;
    this.drawDecor(context, decor);
    context.restore();
  }

  getFloorDecor() {
    return LIVING_ROOM_DECOR.filter((decor) => decor.layer === "floor");
  }

  drawWallRect(context, wall) {
    const { x, y, width, height } = wall;
    context.fillStyle = "#2c202a";
    context.fillRect(x, y, width, height);
    context.fillStyle = "#503742";
    context.fillRect(x + 3, y + 3, width - 6, height - 6);
    context.fillStyle = "#92604f";
    if (width >= height) {
      context.fillRect(x + 4, y + 3, width - 8, 3);
      context.fillStyle = "#6d4650";
      context.fillRect(x + 4, y + 7, width - 8, Math.max(2, height - 11));
      context.fillStyle = "#241d26";
      context.fillRect(x + 3, y + height - 4, width - 6, 2);
      for (let seamX = x + 34; seamX < x + width - 12; seamX += 46) {
        pixelRect(context, seamX, y + 8, 2, Math.max(2, height - 12), "rgba(35, 25, 31, 0.45)");
        pixelRect(context, seamX + 3, y + 8, 2, 2, "rgba(210, 148, 107, 0.45)");
      }
    } else {
      context.fillRect(x + 3, y + 4, 3, height - 8);
      context.fillStyle = "#6d4650";
      context.fillRect(x + 7, y + 4, Math.max(2, width - 11), height - 8);
      context.fillStyle = "#241d26";
      context.fillRect(x + width - 4, y + 3, 2, height - 6);
      for (let seamY = y + 34; seamY < y + height - 12; seamY += 46) {
        pixelRect(context, x + 8, seamY, Math.max(2, width - 12), 2, "rgba(35, 25, 31, 0.45)");
        pixelRect(context, x + 8, seamY + 3, 2, 2, "rgba(210, 148, 107, 0.45)");
      }
    }
    context.strokeStyle = "#201a22";
    context.lineWidth = 3;
    context.strokeRect(x + 1.5, y + 1.5, Math.max(0, width - 3), Math.max(0, height - 3));
  }

  drawRoomTrim(context, house, room) {
    const doors = house.doorways.filter((door) => door.roomId === room.id);
    for (const side of ["north", "south", "east", "west"]) {
      const horizontal = side === "north" || side === "south";
      const start = horizontal ? room.x : room.y;
      const length = horizontal ? room.width : room.height;
      const openings = doors.filter((door) => door.side === side)
        .map((door) => {
          const openingStart = horizontal ? door.x - room.x : door.y - room.y;
          return { start: openingStart, end: openingStart + (horizontal ? door.width : door.height) };
        })
        .sort((a, b) => a.start - b.start);
      let cursor = 0;
      const drawSegment = (from, to) => {
        if (to - from < 14) return;
        if (horizontal) {
          const y = side === "north" ? room.y + 7 : room.y + room.height - 13;
          pixelRect(context, start + from, y, to - from, 7, "#4a303a");
          pixelRect(context, start + from, y + 1, to - from, 2, "#956451");
          pixelRect(context, start + from, y + 5, to - from, 2, "#2c202a");
        } else {
          const x = side === "west" ? room.x + 7 : room.x + room.width - 13;
          pixelRect(context, x, start + from, 7, to - from, "#4a303a");
          pixelRect(context, x + 1, start + from, 2, to - from, "#956451");
          pixelRect(context, x + 5, start + from, 2, to - from, "#2c202a");
        }
      };
      for (const opening of openings) {
        drawSegment(cursor, opening.start);
        cursor = Math.max(cursor, opening.end);
      }
      drawSegment(cursor, length);
    }
  }

  drawProp(context, decor) {
    const sprite = SPRITES[decor.sprite];
    if (!sprite || !this.atlasLoaded) return false;
    const rotated = Math.abs(decor.rotation ?? 0) % 180 === 90;
    const fitWidth = rotated ? decor.height : decor.width;
    const fitHeight = rotated ? decor.width : decor.height;
    const scale = Math.min(fitWidth / sprite.width, fitHeight / sprite.height);
    const width = Math.max(1, Math.round(sprite.width * scale));
    const height = Math.max(1, Math.round(sprite.height * scale));
    context.save();
    context.translate(decor.x + decor.width / 2, decor.y + decor.height / 2);
    context.rotate((decor.rotation ?? 0) * Math.PI / 180);
    context.drawImage(this.atlas, sprite.x, sprite.y, sprite.width, sprite.height, -width / 2, -height / 2, width, height);
    context.restore();
    return true;
  }

  drawDecor(context, decor) {
    this.drawProp(context, decor);
  }
}
