import { HOUSE_FURNITURE_SPRITES, getHouseFurnitureSpriteBounds } from "./FurnitureSpriteData.js";
import { getFurnitureDamageFilter } from "./FurnitureVisualData.js";

const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

function outline(ctx, item, color = "#35241f", width = 4) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(item.x + width / 2, item.y + width / 2, item.width - width, item.height - width);
}

function shadow(ctx, item) {
  px(ctx, item.x + 6, item.y + item.height - 3, item.width - 12, 10, "rgba(37,25,22,.34)");
}

function drawWoodCabinet(ctx, item, color = "#70472e", withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 4, y + 6, w - 8, h - 6, "#39261f");
  px(ctx, x + 7, y + 3, w - 14, h - 11, "#a66a3b");
  px(ctx, x + 11, y + 7, w - 22, h - 20, color);
  px(ctx, x + 13, y + 9, w - 26, 4, "#d19a57");
  px(ctx, x + 12, y + h - 13, w - 24, 4, "#4c3025");
  const count = w > 150 ? 3 : w > 90 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const panelW = (w - 28 - (count - 1) * 5) / count;
    const px0 = x + 14 + i * (panelW + 5);
    px(ctx, px0, y + 17, panelW, Math.max(13, h - 37), i % 2 ? "#87522f" : "#925b32");
    px(ctx, px0 + 4, y + 20, 2, Math.max(8, h - 44), "rgba(227,176,103,.34)");
    px(ctx, px0 + panelW - 7, y + h / 2, 3, 5, "#e4bd70");
  }
  outline(ctx, item);
}

function drawTable(ctx, item, kitchen = false, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 9, y + 11, w - 18, h - 5, "#4b2c20");
  px(ctx, x + 5, y + 4, w - 10, h - 17, "#8a532f");
  px(ctx, x + 10, y + 8, w - 20, h - 27, "#bd8045");
  px(ctx, x + 15, y + 12, w - 30, 3, "#e0ad65");
  for (let plank = 1; plank < 4; plank++) px(ctx, x + 12, y + 10 + plank * (h - 31) / 4, w - 24, 2, "rgba(91,50,29,.45)");
  px(ctx, x + 15, y + h - 10, 8, 10, "#563421");
  px(ctx, x + w - 23, y + h - 10, 8, 10, "#563421");
  if (kitchen) {
    px(ctx, x + w * .28, y + h * .23, w * .43, h * .43, "#d5c69d");
    px(ctx, x + w * .32, y + h * .28, w * .35, 3, "#f0e2c0");
    px(ctx, x + w * .45, y + h * .38, 22, 15, "#e4d5b2");
    px(ctx, x + w * .49, y + h * .4, 12, 8, "#b8c7bd");
    for (const ox of [x + w * .22, x + w * .75]) {
      px(ctx, ox, y + h * .35, 14, 14, "#c8d9d4");
      px(ctx, ox + 3, y + h * .38, 8, 8, "#efe5ce");
    }
  } else {
    px(ctx, x + w * .26, y + h * .25, 24, 18, "#5c392b");
    px(ctx, x + w * .29, y + h * .21, 18, 4, "#d9bd84");
    px(ctx, x + w * .63, y + h * .3, 20, 15, "#e3d3b5");
    px(ctx, x + w * .69, y + h * .33, 8, 9, "#9baea4");
  }
  outline(ctx, item);
}

function drawKitchenCounter(ctx, item, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 2, y + 11, w - 4, h - 6, "#4c3228");
  px(ctx, x + 4, y + 8, w - 8, h - 13, "#76503a");
  for (let i = 0; i < 4; i++) {
    const cw = (w - 16) / 4;
    px(ctx, x + 7 + i * cw, y + 20, cw - 3, h - 25, i % 2 ? "#8a5b3e" : "#795038");
    px(ctx, x + 7 + i * cw + cw / 2, y + h - 17, 4, 3, "#e4bd72");
  }
  px(ctx, x + 1, y + 2, w - 2, 17, "#b7a993");
  px(ctx, x + 4, y + 4, w - 8, 10, "#d2c6ac");
  // Sink, tap and four-burner hob are painted into the fixed counter footprint.
  px(ctx, x + 35, y + 5, 64, 10, "#657b7b");
  px(ctx, x + 40, y + 7, 54, 6, "#b3cbc5");
  px(ctx, x + 63, y + 3, 4, 4, "#e6d5b0");
  px(ctx, x + w - 91, y + 3, 78, 12, "#3d3735");
  for (const dx of [8, 39]) for (const dy of [0, 7]) {
    px(ctx, x + w - 88 + dx, y + 5 + dy, 22, 2, "#9e9a8c");
    px(ctx, x + w - 81 + dx, y + 2 + dy, 3, 8, "#222426");
  }
  outline(ctx, item);
}

function drawBed(ctx, item, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 6, y + 4, w - 12, h - 6, "#442d29");
  px(ctx, x + 10, y + 7, w - 20, h - 15, "#885638");
  px(ctx, x + 16, y + 18, w - 32, h - 32, "#647647");
  px(ctx, x + 20, y + 21, w - 40, h - 42, "#819354");
  px(ctx, x + 20, y + 18, w - 40, 34, "#e4d4b8");
  px(ctx, x + 24, y + 23, w * .35, 25, "#f2e6cf");
  px(ctx, x + w * .57, y + 23, w * .32, 25, "#f2e6cf");
  px(ctx, x + 20, y + 54, w - 40, 3, "#b6bc8d");
  px(ctx, x + 20, y + h - 21, w - 40, 5, "#40543a");
  outline(ctx, item);
}

function drawBath(ctx, item, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 4, y + 7, w - 8, h - 8, "#493f3b");
  px(ctx, x + 8, y + 4, w - 16, h - 13, "#e2ddd0");
  px(ctx, x + 13, y + 10, w - 26, h - 26, "#91b6ba");
  px(ctx, x + 17, y + 14, w - 34, h - 34, "#b9d7d3");
  px(ctx, x + 18, y + h - 18, w - 36, 4, "#e8e4da");
  px(ctx, x + w - 27, y + 14, 4, 16, "#ad9d7d");
  px(ctx, x + w - 31, y + 11, 12, 4, "#baa887");
  outline(ctx, item, "#4a4944", 4);
}

function drawVanity(ctx, item, withShadow = true) {
  drawWoodCabinet(ctx, item, "#59716c", withShadow);
  const { x, y, width: w } = item;
  px(ctx, x + 14, y + 7, w - 28, 22, "#d7e0d7");
  px(ctx, x + 21, y + 10, w - 42, 15, "#8eafb0");
  px(ctx, x + w / 2 - 2, y + 7, 4, 11, "#9eac9d");
}

function drawCrates(ctx, item, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  const boxes = [
    { x: x + 2, y: y + 20, w: w * .55, h: h * .72, c: "#936c3e" },
    { x: x + w * .42, y: y + 2, w: w * .54, h: h * .7, c: "#ae814a" },
  ];
  for (const b of boxes) {
    px(ctx, b.x + 3, b.y + 4, b.w - 5, b.h - 3, "#453126");
    px(ctx, b.x, b.y, b.w - 7, b.h - 8, b.c);
    px(ctx, b.x + 5, b.y + 6, b.w - 17, 4, "#d1a05d");
    px(ctx, b.x + 8, b.y + 9, 4, b.h - 24, "#76502f");
    px(ctx, b.x + b.w - 20, b.y + 9, 4, b.h - 24, "#76502f");
    outline(ctx, { x: b.x, y: b.y, width: b.w - 7, height: b.h - 8 });
  }
}

function drawShelves(ctx, item, withShadow = true) {
  const { x, y, width: w, height: h } = item;
  if (withShadow) shadow(ctx, item);
  px(ctx, x + 3, y + 7, w - 6, h - 3, "#37271f");
  px(ctx, x + 7, y + 3, w - 14, h - 12, "#86562f");
  for (let shelf = 0; shelf < 2; shelf++) {
    const sy = y + 13 + shelf * 23;
    px(ctx, x + 9, sy + 16, w - 18, 5, "#d3a062");
    let bx = x + 13;
    for (let n = 0; n < 7; n++) {
      const bw = 7 + (n % 3) * 2;
      const bh = 10 + ((n + shelf) % 3) * 3;
      px(ctx, bx, sy + 15 - bh, bw, bh, ["#52604a", "#984d39", "#bd8c4a", "#586c79", "#d2b476"][n % 5]);
      px(ctx, bx + 2, sy + 15 - bh + 2, 2, bh - 4, "rgba(245,218,166,.42)");
      bx += bw + 3;
    }
  }
  outline(ctx, item);
}

export class HousePropsRenderer {
  constructor() {
    this.furnitureAtlasImage = new Image();
    this.furnitureAtlas = null;
    this.furnitureAtlasImage.onload = () => {
      this.furnitureAtlas = this.preparePixelAtlas(this.furnitureAtlasImage);
    };
    this.furnitureAtlasImage.onerror = () => console.error("Could not load house furniture sprite atlas.");
    this.furnitureAtlasImage.src = new URL("../../assets/rooms/house-furniture-atlas.png", import.meta.url).href;

    this.counterImage = new Image();
    this.counterCanvas = null;
    this.counterImage.onload = () => {
      this.counterCanvas = this.preparePixelAtlas(this.counterImage);
    };
    this.counterImage.onerror = () => console.error("Could not load kitchen counter sprite.");
    this.counterImage.src = new URL("../../assets/rooms/kitchen-counter-sprite.png", import.meta.url).href;
  }

  preparePixelAtlas(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, 0);

    // Generated alpha edges have a narrow saturated red fringe. Remove only
    // those pixels; keep the warm red wood, upholstery, and brass reflections.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 220 && imageData.data[i + 1] < 70 && imageData.data[i + 2] < 70) {
        imageData.data[i + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  drawFurnitureSprite(ctx, item, damageStage = 0) {
    const sprite = HOUSE_FURNITURE_SPRITES[item.id];
    const source = sprite?.source === "counter" ? this.counterCanvas : this.furnitureAtlas;
    if (!sprite || !source) return false;

    const bounds = getHouseFurnitureSpriteBounds(item);
    const rect = sprite.source === "counter"
      ? { x: 227, y: 184, width: 1625, height: 466 }
      : sprite.rect;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.filter = getFurnitureDamageFilter(damageStage);
    ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height,
      Math.round(bounds.x), Math.round(bounds.y), Math.round(bounds.width), Math.round(bounds.height));
    ctx.restore();
    return true;
  }

  drawFurniture(ctx, item, damageStage = 0) {
    if (this.drawFurnitureSprite(ctx, item, damageStage)) return;
    ctx.save();
    shadow(ctx, item);
    ctx.filter = getFurnitureDamageFilter(damageStage);
    switch (item.id) {
      case "kitchen-counter": drawKitchenCounter(ctx, item, false); break;
      case "kitchen-table": drawTable(ctx, item, true, false); break;
      case "kitchen-cabinet": drawWoodCabinet(ctx, item, "#586756", false); px(ctx, item.x + 20, item.y + 10, item.width - 40, 23, "#aebcaa"); break;
      case "pantry-shelves": drawShelves(ctx, item, false); break;
      case "pantry-crates":
      case "storage-boxes": drawCrates(ctx, item, false); break;
      case "study-desk": drawTable(ctx, item, false, false); px(ctx, item.x + 23, item.y + 19, 30, 21, "#58402f"); px(ctx, item.x + 25, item.y + 14, 24, 7, "#dfc58c"); break;
      case "bookcase": drawShelves(ctx, item, false); break;
      case "bed": drawBed(ctx, item, false); break;
      case "wardrobe": drawWoodCabinet(ctx, item, "#765037", false); break;
      case "bath": drawBath(ctx, item, false); break;
      case "bathroom-vanity": drawVanity(ctx, item, false); break;
      case "storage-cabinet": drawWoodCabinet(ctx, item, "#6b503a", false); break;
      default: drawWoodCabinet(ctx, item, "#70472e", false);
    }
    ctx.restore();
  }
}
