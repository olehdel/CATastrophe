import { FURNITURE_VISUALS, getFurnitureVisualDamageStage } from "./FurnitureVisualData.js";
import { LivingRoomRenderer } from "./LivingRoomRenderer.js";
import { HousePropsRenderer } from "./HousePropsRenderer.js";
import { ExteriorGardenRenderer } from "./ExteriorGardenRenderer.js";
import { getFurnitureVisualBounds } from "./FurnitureBounds.js";

const STATIC_CHUNK_SIZE = 512;

function drawFloorPattern(context, rect, pattern) {
  context.save();
  context.beginPath();
  context.rect(rect.x, rect.y, rect.width, rect.height);
  context.clip();
  context.strokeStyle = "rgba(40, 35, 31, 0.11)";
  context.lineWidth = 2;

  if (pattern === "tiles") {
    const firstTileX = Math.ceil((rect.x - 24) / 48);
    const firstTileY = Math.ceil((rect.y - 24) / 48);
    for (let index = firstTileX, x = 24 + index * 48; x < rect.x + rect.width; index += 1, x = 24 + index * 48) {
      context.beginPath();
      context.moveTo(x, rect.y);
      context.lineTo(x, rect.y + rect.height);
      context.stroke();
    }
    for (let index = firstTileY, y = 24 + index * 48; y < rect.y + rect.height; index += 1, y = 24 + index * 48) {
      context.beginPath();
      context.moveTo(rect.x, y);
      context.lineTo(rect.x + rect.width, y);
      context.stroke();
    }
  } else {
    const firstPlank = Math.ceil((rect.y - 34) / 34);
    for (let plank = firstPlank, y = 34 + plank * 34; y < rect.y + rect.height; plank += 1, y = 34 + plank * 34) {
      context.beginPath();
      context.moveTo(rect.x, y);
      context.lineTo(rect.x + rect.width, y);
      context.stroke();
    }
    const firstRow = Math.floor(rect.y / 68);
    const lastRow = Math.ceil((rect.y + rect.height) / 68);
    for (let row = firstRow; row < lastRow; row += 1) {
      const y = row * 68;
      const start = row % 2 ? 30 : 0;
      const firstSeam = Math.ceil((rect.x - start - 60) / 120);
      for (let seam = firstSeam, x = start + 60 + seam * 120; x < rect.x + rect.width; seam += 1, x = start + 60 + seam * 120) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, Math.min(y + 68, rect.y + rect.height));
        context.stroke();
      }
    }
  }
  context.restore();
}

export class HouseRenderer {
  constructor() {
    this.livingRoomRenderer = new LivingRoomRenderer();
    this.housePropsRenderer = new HousePropsRenderer();
    this.exteriorGardenRenderer = new ExteriorGardenRenderer();
    this.floorChunks = [];
    this.structureChunks = [];
    this.cachedHouse = null;
    this.cacheAssetState = "";
    this.damageOverlayCache = new Map();
    this.livingRoomRenderer.onLoad = () => {
      this.floorChunks = [];
      this.structureChunks = [];
      this.onAssetsLoaded?.();
    };
    this.exteriorGardenRenderer.onLoad = () => {
      this.floorChunks = [];
      this.structureChunks = [];
      this.onAssetsLoaded?.();
    };
  }

  draw(context, house, viewportWidth, viewportHeight, camera = null, actorDrawables = [], furnitureSystem = null, drawDebugVision = null, furnitureEffects = null, interactionOptions = {}) {
    this.currentCamera = camera;
    this.currentViewportWidth = viewportWidth;
    this.currentViewportHeight = viewportHeight;
    const scale = camera?.zoom ?? Math.min(viewportWidth / house.width, viewportHeight / house.height);
    const offsetX = camera
      ? viewportWidth / 2 - camera.x * scale
      : (viewportWidth - house.width * scale) / 2;
    const offsetY = camera
      ? viewportHeight / 2 - camera.y * scale
      : (viewportHeight - house.height * scale) / 2;

    // Camera coordinates remain smooth in world space, but a fractional
    // canvas translation changes the sampling phase of pixel-art textures on
    // every frame. Snap one shared world transform to the backing-store pixel
    // grid so every floor/structure chunk and actor keeps the same alignment.
    const pixelRatio = Math.abs(context.getTransform?.().a) || 1;
    const renderOffsetX = Math.round(offsetX * pixelRatio) / pixelRatio;
    const renderOffsetY = Math.round(offsetY * pixelRatio) / pixelRatio;

    context.save();
    context.translate(renderOffsetX, renderOffsetY);
    context.scale(scale, scale);
    this.drawWorld(context, house, furnitureSystem, drawDebugVision, furnitureEffects, actorDrawables, interactionOptions);
    context.restore();

    // The selection outline is an overlay, not part of the world depth queue.
    // Drawing it after the world transform is restored keeps it above every
    // object and lets the stroke land on whole device pixels.
    if (!interactionOptions.mouseCatchable) {
      this.drawSelectionOutline(context, furnitureSystem, scale, renderOffsetX, renderOffsetY);
    }
  }

  drawWorld(context, house, furnitureSystem = null, drawDebugVision = null, furnitureEffects = null, actorDrawables = [], interactionOptions = {}) {
    this.ensureStaticLayers(house);
    context.save();
    context.imageSmoothingEnabled = false;
    this.drawStaticChunks(context, this.floorChunks);
    context.restore();
    this.drawCachedLayer(context, this.structureChunks);
    if (drawDebugVision) drawDebugVision(context);

    // Rugs and living-room floor art are placed below all actors. Raised
    // furniture and actors share one world-space depth queue across the house.
    const livingFurniture = house.furniture.filter((item) => item.id === "living-rug");
    for (const item of livingFurniture) this.drawFurnitureItem(context, item, furnitureSystem);
    const entries = [
      ...house.furniture.filter((item) => item.id !== "living-rug").map((item) => ({
        depth: item.y + item.height,
        draw: () => this.drawFurnitureItem(context, item, furnitureSystem),
      })),
      ...this.livingRoomRenderer.getFloorDecor().map((decor) => ({
        depth: decor.depth ?? decor.y + decor.height,
        draw: () => this.livingRoomRenderer.drawFloorDecor(context, decor),
      })),
      ...(Array.isArray(actorDrawables) ? actorDrawables : []).filter((actor) => !actor.alwaysOnTop).map((actor) => ({
        depth: actor.depth ?? actor.y ?? 0,
        draw: () => actor.draw(context),
      })),
    ];
    entries.sort((a, b) => a.depth - b.depth);
    for (const entry of entries) entry.draw();
    for (const actor of (Array.isArray(actorDrawables) ? actorDrawables : []).filter((entry) => entry.alwaysOnTop)) actor.draw(context);
    furnitureEffects?.draw(context);
    this.drawInteractionTarget(
      context,
      interactionOptions.mouseCatchable ? null : furnitureSystem,
      !interactionOptions.touchInput,
    );
  }

  drawCachedLayer(context, chunks) {
    context.save();
    context.imageSmoothingEnabled = false;
    this.drawStaticChunks(context, chunks);
    context.restore();
  }

  drawStaticChunks(context, chunks) {
    const camera = this.currentCamera;
    if (camera) {
      const viewW = this.currentViewportWidth / camera.zoom;
      const viewH = this.currentViewportHeight / camera.zoom;
      const left = Math.max(0, camera.x - viewW / 2);
      const top = Math.max(0, camera.y - viewH / 2);
      const right = Math.min(this.cachedHouse.width, camera.x + viewW / 2);
      const bottom = Math.min(this.cachedHouse.height, camera.y + viewH / 2);
      const firstColumn = Math.floor(left / STATIC_CHUNK_SIZE);
      const lastColumn = Math.floor(Math.max(left, right - 1) / STATIC_CHUNK_SIZE);
      const firstRow = Math.floor(top / STATIC_CHUNK_SIZE);
      const lastRow = Math.floor(Math.max(top, bottom - 1) / STATIC_CHUNK_SIZE);
      const columnCount = Math.ceil(this.cachedHouse.width / STATIC_CHUNK_SIZE);
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const chunk = chunks[row * columnCount + column];
          if (chunk) context.drawImage(chunk.canvas, chunk.x, chunk.y);
        }
      }
      return;
    }
    for (const chunk of chunks) context.drawImage(chunk.canvas, chunk.x, chunk.y);
  }

  splitLayerIntoChunks(layer) {
    const chunks = [];
    for (let y = 0; y < layer.height; y += STATIC_CHUNK_SIZE) {
      for (let x = 0; x < layer.width; x += STATIC_CHUNK_SIZE) {
        const width = Math.min(STATIC_CHUNK_SIZE, layer.width - x);
        const height = Math.min(STATIC_CHUNK_SIZE, layer.height - y);
        // These fixed world-space chunks are cut from the fully rendered
        // cache, so every texture keeps its original world-aligned phase.
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const chunkContext = canvas.getContext("2d");
        chunkContext.imageSmoothingEnabled = false;
        chunkContext.drawImage(layer, x, y, width, height, 0, 0, width, height);
        chunks.push({ x, y, canvas });
      }
    }
    return chunks;
  }

  ensureStaticLayers(house) {
    const assetState = `${this.livingRoomRenderer.floorLoaded}:${this.livingRoomRenderer.atlasLoaded}:${this.livingRoomRenderer.kitchenTileLoaded}:${this.livingRoomRenderer.bathroomTileLoaded}:${this.exteriorGardenRenderer.grassLoaded}:${this.exteriorGardenRenderer.atlasLoaded}`;
    if (this.floorChunks.length && this.structureChunks.length && this.cachedHouse === house && this.cacheAssetState === assetState) return;

    this.cachedHouse = house;
    this.cacheAssetState = assetState;
    const floorLayer = document.createElement("canvas");
    floorLayer.width = house.width;
    floorLayer.height = house.height;
    const floorContext = floorLayer.getContext("2d");
    floorContext.imageSmoothingEnabled = false;
    this.drawFloorLayer(floorContext, house);
    this.floorChunks = this.splitLayerIntoChunks(floorLayer);

    const structureLayer = document.createElement("canvas");
    structureLayer.width = house.width;
    structureLayer.height = house.height;
    const structureContext = structureLayer.getContext("2d");
    structureContext.imageSmoothingEnabled = false;
    this.drawWalls(structureContext, house.walls, house);
    this.drawEntranceDoor(structureContext, house.entranceDoor);
    const livingRoom = house.rooms.find((room) => room.id === "living-room");
    if (livingRoom) this.livingRoomRenderer.drawRoomDetails(structureContext, house, livingRoom);
    this.structureChunks = this.splitLayerIntoChunks(structureLayer);
  }

  drawFloorLayer(context, house) {
    this.exteriorGardenRenderer.draw(context, house);

    for (const corridor of house.corridors) {
      if (this.livingRoomRenderer.drawFloor(context, corridor)) continue;
      context.fillStyle = corridor.floor;
      context.fillRect(corridor.x, corridor.y, corridor.width, corridor.height);
      drawFloorPattern(context, corridor, "planks");
    }

    for (const room of house.rooms) {
      if (!this.livingRoomRenderer.drawFloor(context, room)) {
        context.fillStyle = room.floor;
        context.fillRect(room.x, room.y, room.width, room.height);
        drawFloorPattern(context, room, room.pattern);
      }
    }

    for (const extension of house.extensions) {
      if (this.livingRoomRenderer.drawFloor(context, extension)) continue;
      context.fillStyle = extension.floor;
      context.fillRect(extension.x, extension.y, extension.width, extension.height);
      drawFloorPattern(context, extension, extension.pattern);
    }

  }

  drawRoomLabel(context, room) {
    context.save();
    context.fillStyle = "rgba(34, 30, 27, 0.56)";
    context.font = "700 26px 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(room.name.toUpperCase(), room.x + room.width / 2, room.y + room.height / 2, room.width - 36);
    context.restore();
  }

  drawWalls(context, walls, house) {
    const subtract = (start, end, covers) => {
      const result = [];
      let cursor = start;
      for (const [from, to] of covers.sort((a, b) => a[0] - b[0])) {
        if (from > cursor) result.push([cursor, Math.min(from, end)]);
        cursor = Math.max(cursor, to);
        if (cursor >= end) break;
      }
      if (cursor < end) result.push([cursor, end]);
      return result.filter(([a, b]) => b > a);
    };

    // Paint every normalized wall face first. Edges are emitted only where a
    // wall meets open floor, so joined 90-degree corners have no internal seam.
    for (const wall of walls) {
      const horizontal = wall.width >= wall.height;
      context.fillStyle = "#2c202a";
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
      context.fillStyle = "#503742";
      context.fillRect(wall.x + 3, wall.y + 3, Math.max(0, wall.width - 6), Math.max(0, wall.height - 6));
      if (horizontal) {
        context.fillStyle = "#92604f";
        context.fillRect(wall.x + 4, wall.y + 3, Math.max(0, wall.width - 8), 3);
        context.fillStyle = "#241d26";
        context.fillRect(wall.x + 3, wall.y + wall.height - 4, Math.max(0, wall.width - 6), 2);
        for (let seam = wall.x + 34; seam < wall.x + wall.width - 12; seam += 46) {
          context.fillStyle = "rgba(35,25,31,.45)";
          context.fillRect(seam, wall.y + 8, 2, Math.max(0, wall.height - 12));
          context.fillStyle = "rgba(210,148,107,.45)";
          context.fillRect(seam + 3, wall.y + 8, 2, 2);
        }
      } else {
        context.fillStyle = "#92604f";
        context.fillRect(wall.x + 3, wall.y + 4, 3, Math.max(0, wall.height - 8));
        context.fillStyle = "#241d26";
        context.fillRect(wall.x + wall.width - 4, wall.y + 3, 2, Math.max(0, wall.height - 6));
        for (let seam = wall.y + 34; seam < wall.y + wall.height - 12; seam += 46) {
          context.fillStyle = "rgba(35,25,31,.45)";
          context.fillRect(wall.x + 8, seam, Math.max(0, wall.width - 12), 2);
          context.fillStyle = "rgba(210,148,107,.45)";
          context.fillRect(wall.x + 8, seam + 3, 2, 2);
        }
      }
    }

    context.save();
    context.strokeStyle = "#201a22";
    context.lineWidth = 3;
    context.lineCap = "square";
    context.lineJoin = "miter";
    for (const wall of walls) {
      const left = walls.filter((other) => other !== wall && other.x + other.width === wall.x
        && other.y < wall.y + wall.height && other.y + other.height > wall.y)
        .map((other) => [Math.max(wall.y, other.y), Math.min(wall.y + wall.height, other.y + other.height)]);
      const right = walls.filter((other) => other !== wall && other.x === wall.x + wall.width
        && other.y < wall.y + wall.height && other.y + other.height > wall.y)
        .map((other) => [Math.max(wall.y, other.y), Math.min(wall.y + wall.height, other.y + other.height)]);
      const top = walls.filter((other) => other !== wall && other.y + other.height === wall.y
        && other.x < wall.x + wall.width && other.x + other.width > wall.x)
        .map((other) => [Math.max(wall.x, other.x), Math.min(wall.x + wall.width, other.x + other.width)]);
      const bottom = walls.filter((other) => other !== wall && other.y === wall.y + wall.height
        && other.x < wall.x + wall.width && other.x + other.width > wall.x)
        .map((other) => [Math.max(wall.x, other.x), Math.min(wall.x + wall.width, other.x + other.width)]);
      for (const [from, to] of subtract(wall.y, wall.y + wall.height, left)) {
        context.beginPath(); context.moveTo(wall.x, from); context.lineTo(wall.x, to); context.stroke();
      }
      for (const [from, to] of subtract(wall.y, wall.y + wall.height, right)) {
        context.beginPath(); context.moveTo(wall.x + wall.width, from); context.lineTo(wall.x + wall.width, to); context.stroke();
      }
      for (const [from, to] of subtract(wall.x, wall.x + wall.width, top)) {
        context.beginPath(); context.moveTo(from, wall.y); context.lineTo(to, wall.y); context.stroke();
      }
      for (const [from, to] of subtract(wall.x, wall.x + wall.width, bottom)) {
        context.beginPath(); context.moveTo(from, wall.y + wall.height); context.lineTo(to, wall.y + wall.height); context.stroke();
      }
    }
    context.restore();
  }

  drawEntranceDoor(context, door) {
    if (!door || door.state !== "closed") return;
    const { x, y, width, height } = door;
    context.save();
    context.imageSmoothingEnabled = false;
    // The wood leaf replaces the wall's painted center at the same footprint;
    // the unchanged continuous wall rectangle remains the solid collision.
    context.fillStyle = "#261c20";
    context.fillRect(x - 3, y - 3, width + 8, height + 6);
    context.fillStyle = "#6b422c";
    context.fillRect(x + 1, y + 2, width - 1, height - 4);
    context.fillStyle = "#9b6238";
    context.fillRect(x + 4, y + 5, width - 6, height - 10);
    context.fillStyle = "#c38a4c";
    context.fillRect(x + 6, y + 7, 3, height - 14);
    context.fillStyle = "#603a29";
    context.fillRect(x + 10, y + 10, Math.max(5, width - 17), height - 20);
    context.fillStyle = "#b77a43";
    context.fillRect(x + 12, y + 13, 2, height - 26);
    // Two inset panels and a raised central stile establish a closed timber door.
    context.strokeStyle = "#40281f";
    context.lineWidth = 2;
    context.strokeRect(x + 9, y + 8, width - 13, 22);
    context.strokeRect(x + 9, y + 40, width - 13, 22);
    context.fillStyle = "#d2a15d";
    context.fillRect(x + width - 6, y + height / 2 - 3, 3, 6);
    context.fillStyle = "#38231c";
    context.fillRect(x + 2, y + 10, 3, 5);
    context.fillRect(x + 2, y + height - 15, 3, 5);
    context.fillStyle = "#d2a15d";
    context.fillRect(x + 2, y + 11, 2, 3);
    context.fillRect(x + 2, y + height - 14, 2, 3);
    context.restore();
  }

  drawFurniture(context, furniture, furnitureSystem) {
    for (const item of furniture) {
      this.drawFurnitureItem(context, item, furnitureSystem);
    }
  }

  drawFurnitureItem(context, item, furnitureSystem) {
      const state = furnitureSystem?.getState(item.id);
      const damageStage = getFurnitureVisualDamageStage(state);
      if (this.livingRoomRenderer.drawFurniture(context, item, damageStage)) {
        if (state) this.drawDamage(context, item, damageStage);
        return;
      }
      this.housePropsRenderer.drawFurniture(context, item, damageStage);
      if (state) this.drawDamage(context, item, damageStage);
  }

  isLivingRoomWall(wall, house) {
    const room = house.rooms.find((entry) => entry.id === "living-room");
    if (!room) return false;
    const centerX = wall.x + wall.width / 2;
    const centerY = wall.y + wall.height / 2;
    const boundaries = [
      { side: "north", x: room.x, y: room.y, width: room.width, height: 0 },
      { side: "south", x: room.x, y: room.y + room.height, width: room.width, height: 0 },
      { side: "west", x: room.x, y: room.y, width: 0, height: room.height },
      { side: "east", x: room.x + room.width, y: room.y, width: 0, height: room.height },
      ...house.extensions.filter((extension) => extension.roomId === room.id).flatMap((extension) => [
        { side: "north", x: extension.x, y: extension.y, width: extension.width, height: 0 },
        { side: "west", x: extension.x, y: extension.y, width: 0, height: extension.height },
        { side: "east", x: extension.x + extension.width, y: extension.y, width: 0, height: extension.height },
      ]),
    ];
    return boundaries.some((edge) => edge.side === "north" || edge.side === "south"
      ? Math.abs(centerY - edge.y) <= 1 && centerX >= edge.x - 1 && centerX <= edge.x + edge.width + 1
      : Math.abs(centerX - edge.x) <= 1 && centerY >= edge.y - 1 && centerY <= edge.y + edge.height + 1);
  }

  drawLivingRoomEntities(context, house, furnitureSystem, actorDrawables) {
    const room = house.rooms.find((entry) => entry.id === "living-room");
    if (!room) return [];
    const isInRoom = (entry) => entry.x >= room.x && entry.x <= room.x + room.width
      && entry.y >= room.y && entry.y <= room.y + room.height;
    const livingFurniture = house.furniture.filter((item) =>
      item.x >= room.x && item.x + item.width <= room.x + room.width
      && item.y >= room.y && item.y + item.height <= room.y + room.height,
    );
    // Rugs are floor art rather than raised objects. Drawing a rug in the
    // furniture/actor depth queue can put it over an actor whose feet are
    // above the rug's bottom edge, so lay it down before all room objects.
    const floorFurniture = livingFurniture.filter((item) => item.id === "living-rug");
    for (const item of floorFurniture) this.drawFurnitureItem(context, item, furnitureSystem);
    const raisedFurniture = livingFurniture.filter((item) => item.id !== "living-rug");
    const livingActors = actorDrawables.filter((actor) => !actor.alwaysOnTop && isInRoom(actor));
    const outsideActors = actorDrawables.filter((actor) => actor.alwaysOnTop || !isInRoom(actor));
    const entries = [
      ...raisedFurniture.map((item) => ({
        depth: item.y + item.height,
        draw: () => this.drawFurnitureItem(context, item, furnitureSystem),
      })),
      ...this.livingRoomRenderer.getFloorDecor().map((decor) => ({
        depth: decor.depth ?? decor.y + decor.height,
        draw: () => this.livingRoomRenderer.drawFloorDecor(context, decor),
      })),
      ...livingActors.map((actor) => ({ depth: actor.depth ?? actor.y, draw: () => actor.draw(context) })),
    ];
    entries.sort((a, b) => a.depth - b.depth);
    for (const entry of entries) entry.draw();
    return outsideActors;
  }

  drawDamage(context, item, stage) {
    if (stage <= 0) return;
    const bounds = getFurnitureVisualBounds(item);
    const overlay = this.getDamageOverlay(item, bounds, stage);
    context.drawImage(overlay, bounds.x, bounds.y, bounds.width, bounds.height);
  }

  getDamageOverlay(item, bounds, stage) {
    const key = `${item.id}:${stage}`;
    const cached = this.damageOverlayCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(bounds.width));
    canvas.height = Math.max(1, Math.ceil(bounds.height));
    const overlayContext = canvas.getContext("2d");
    overlayContext.imageSmoothingEnabled = false;
    overlayContext.save();
    overlayContext.translate(-bounds.x, -bounds.y);
    overlayContext.beginPath();
    overlayContext.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    overlayContext.clip();
    this.drawCentralCrack(overlayContext, item, bounds, stage);
    overlayContext.restore();
    this.damageOverlayCache.set(key, canvas);
    return canvas;
  }

  drawCentralCrack(context, item, bounds, stage) {
    const visual = FURNITURE_VISUALS[item.id] ?? { material: "wood", accent: "#d8a05e" };
    const seed = [...item.id].reduce((value, character) => value + character.charCodeAt(0), 0);
    const mirror = seed % 2 ? -1 : 1;
    const horizontal = bounds.width >= bounds.height;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const spread = [0, 0.28, 0.52, 0.76, 1][stage];
    const radiusX = (horizontal ? bounds.width * 0.43 : bounds.width * 0.24) * spread;
    const radiusY = (horizontal ? bounds.height * 0.24 : bounds.height * 0.43) * spread;
    const point = ([u, v]) => ({
      x: centerX + u * radiusX * mirror,
      y: centerY + v * radiusY,
    });
    const crackShapes = [
      {
        main: [[-0.92, -0.16], [-0.43, -0.08], [-0.04, 0.02], [0.36, 0.12], [0.9, 0.23]],
        branches: [
          [[-0.43, -0.08], [-0.55, -0.42], [-0.78, -0.57]], [[-0.04, 0.02], [0.03, -0.34], [0.2, -0.55]],
          [[0.36, 0.12], [0.52, 0.4], [0.76, 0.5]], [[0.9, 0.23], [0.97, -0.08], [0.84, -0.38]],
          [[-0.43, -0.08], [-0.31, 0.22], [-0.48, 0.43]], [[0.03, -0.34], [-0.13, -0.61]],
        ],
      },
      {
        main: [[-0.9, 0.19], [-0.52, 0.06], [-0.1, -0.12], [0.28, 0.04], [0.91, -0.2]],
        branches: [
          [[-0.52, 0.06], [-0.65, -0.27], [-0.82, -0.42]], [[-0.1, -0.12], [-0.02, -0.43], [0.18, -0.6]],
          [[0.28, 0.04], [0.48, 0.36], [0.72, 0.54]], [[0.91, -0.2], [0.79, 0.13], [0.94, 0.37]],
          [[-0.1, -0.12], [-0.29, 0.24], [-0.5, 0.47]], [[0.48, 0.36], [0.37, 0.63]],
        ],
      },
      {
        main: [[-0.93, -0.22], [-0.61, 0.02], [-0.18, 0.15], [0.22, -0.04], [0.9, 0.18]],
        branches: [
          [[-0.61, 0.02], [-0.73, -0.33], [-0.9, -0.48]], [[-0.18, 0.15], [-0.08, 0.49], [0.1, 0.62]],
          [[0.22, -0.04], [0.41, -0.35], [0.66, -0.5]], [[0.9, 0.18], [0.82, -0.18], [0.96, -0.42]],
          [[0.22, -0.04], [0.32, 0.29], [0.52, 0.43]], [[-0.73, -0.33], [-0.55, -0.59]],
        ],
      },
    ];
    const shape = crackShapes[seed % crackShapes.length];
    const branchCount = [0, 0, 1, 3, 6][stage];
    const material = visual.material;
    const isFabric = material === "fabric" || material === "rug" || material === "woven";
    const isHard = material === "stone" || material === "ceramic" || material === "glass";
    const dark = isHard ? "#303638" : isFabric ? "#392b2e" : "#35241d";
    const light = isHard ? "#c4d0c5" : isFabric ? "#e5c69d" : material === "painted-wood" ? "#e0bd83" : visual.accent;
    const width = Math.max(2, Math.min(5, stage + 1));

    const stroke = (normalizedPoints, color, lineWidth, offsetX = 0, offsetY = 0) => {
      const crispOffset = lineWidth % 2 ? 0.5 : 0;
      const coordinates = normalizedPoints.map(point).map(({ x, y }) => ({
        x: Math.round(x + offsetX) + crispOffset,
        y: Math.round(y + offsetY) + crispOffset,
      }));
      context.beginPath();
      context.lineCap = "square";
      context.lineJoin = isHard ? "miter" : "bevel";
      context.strokeStyle = color;
      context.lineWidth = lineWidth;
      context.moveTo(coordinates[0].x, coordinates[0].y);
      for (let index = 1; index < coordinates.length; index += 1) {
        context.lineTo(coordinates[index].x, coordinates[index].y);
      }
      context.stroke();
    };

    // A dark split with a one-pixel lit edge reads as a crack without turning
    // into a broad black slash. Fabric uses a softer seam and frayed branches.
    stroke(shape.main, dark, width);
    stroke(shape.main, light, Math.max(1, width - 2), -1, -1);
    for (let index = 0; index < branchCount; index += 1) {
      stroke(shape.branches[index], dark, Math.max(2, width - 1));
      stroke(shape.branches[index], light, 1, -1, -1);
    }
    if (isFabric && stage >= 2) {
      context.fillStyle = dark;
      const seam = point([-0.04, 0.02]);
      context.fillRect(Math.round(seam.x - 2), Math.round(seam.y - 2), 5 + stage, 3);
      context.fillStyle = light;
      context.fillRect(Math.round(seam.x - 1), Math.round(seam.y - 3), 3 + stage, 1);
    }
    if (isHard && stage >= 4) {
      const origin = point([-0.04, 0.02]);
      context.fillStyle = dark;
      context.fillRect(Math.round(origin.x - 3), Math.round(origin.y - 3), 2, 2);
      context.fillRect(Math.round(origin.x + 2), Math.round(origin.y + 2), 2, 2);
    }
  }

  drawInteractionTarget(context, furnitureSystem, showPrompt = true) {
    const target = furnitureSystem?.target;
    if (!target) return;
    const { item } = target;
    const bounds = target.visualBounds ?? getFurnitureVisualBounds(item);
    context.save();

    // Persistent total damage is shown above the visible object.
    const damageBarWidth = Math.min(112, Math.max(64, bounds.width - 8));
    const damageBarX = bounds.x + (bounds.width - damageBarWidth) / 2;
    const damageBarY = bounds.y - 10;
    context.fillStyle = "#302720";
    context.fillRect(damageBarX - 3, damageBarY - 3, damageBarWidth + 6, 12);
    context.fillStyle = "#e6d6bd";
    context.fillRect(damageBarX, damageBarY, damageBarWidth, 6);
    context.fillStyle = "#d57a3a";
    context.fillRect(damageBarX, damageBarY, damageBarWidth * furnitureSystem.getDamageProgress(item.id), 6);
    context.fillStyle = "rgba(48, 39, 32, 0.85)";
    context.fillRect(damageBarX + Math.round(damageBarWidth / 3), damageBarY - 1, 2, 8);
    context.fillRect(damageBarX + Math.round(damageBarWidth * 2 / 3), damageBarY - 1, 2, 8);

    if (showPrompt) this.drawFurniturePrompt(context, bounds);

    context.restore();
  }

  // Final overlay pass. Coordinates are converted from world space to the
  // canvas backing store so the outline stays crisp at any camera zoom/DPR.
  drawSelectionOutline(context, furnitureSystem, scale, offsetX, offsetY) {
    const target = furnitureSystem?.target;
    if (!target) return;
    const bounds = target.visualBounds ?? getFurnitureVisualBounds(target.item);
    const ratio = Math.abs(context.getTransform?.().a) || 1;
    const left = Math.round((bounds.x * scale + offsetX) * ratio);
    const top = Math.round((bounds.y * scale + offsetY) * ratio);
    const right = Math.round(((bounds.x + bounds.width) * scale + offsetX) * ratio);
    const bottom = Math.round(((bounds.y + bounds.height) * scale + offsetY) * ratio);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const lineWidth = Math.max(1, Math.round(3 * ratio));
    const crisp = lineWidth % 2 ? 0.5 : 0;
    const dash = [Math.max(1, Math.round(8 * ratio)), Math.max(1, Math.round(6 * ratio))];

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.setLineDash(dash);

    // A dark under-stroke keeps the light dashes readable against light wood,
    // tile, and pale furniture without changing the established gold style.
    context.strokeStyle = "rgba(28, 22, 18, 0.9)";
    context.lineWidth = lineWidth + Math.max(2, Math.round(2 * ratio));
    context.strokeRect(left + crisp, top + crisp, width, height);

    context.strokeStyle = furnitureSystem.scratchHeld ? "#f3a454" : "#f0d095";
    context.lineWidth = lineWidth;
    context.strokeRect(left + crisp, top + crisp, width, height);

    context.setLineDash([]);
    context.restore();
  }

  drawFurniturePrompt(context, bounds) {
    const pulse = 0.96 + Math.sin(performance.now() / 240) * 0.04;
    const width = 78;
    const height = 24;
    const x = Math.round(bounds.x + (bounds.width - width) / 2);
    const y = Math.round(bounds.y - 42);
    context.save();
    context.globalAlpha = pulse;
    context.fillStyle = "rgba(35, 29, 25, 0.96)";
    context.fillRect(x - 2, y - 2, width + 4, height + 4);
    context.strokeStyle = "#f3bd70";
    context.lineWidth = 2;
    context.strokeRect(x - 1, y - 1, width + 2, height + 2);
    context.fillStyle = "#fff0c2";
    context.font = "800 15px 'Segoe UI', sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("HOLD E", x + width / 2, y + height / 2);
    context.restore();
  }

}
