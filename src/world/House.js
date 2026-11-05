import { circleIntersectsRect, segmentIntersectsRect } from "../core/Collision.js";
import { LIVING_ROOM_DECOR_COLLISIONS } from "./LivingRoomDecor.js";
import { getFurnitureCollisionBounds } from "./FurnitureBounds.js";

const SIDES = Object.freeze({
  north: { axis: "horizontal", x: (room) => room.x, y: (room) => room.y },
  south: { axis: "horizontal", x: (room) => room.x, y: (room) => room.y + room.height },
  west: { axis: "vertical", x: (room) => room.x, y: (room) => room.y },
  east: { axis: "vertical", x: (room) => room.x + room.width, y: (room) => room.y },
});

function makeEdgeWalls(room, side, openings, thickness) {
  const edge = SIDES[side];
  const length = edge.axis === "horizontal" ? room.width : room.height;
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);
  const segments = [];
  let cursor = 0;

  for (const opening of sorted) {
    const start = Math.max(cursor, opening.offset);
    const end = Math.min(length, opening.offset + opening.width);
    if (start > cursor) segments.push(makeWallRect(edge, room, cursor, start - cursor, thickness));
    cursor = Math.max(cursor, end);
  }

  if (cursor < length) segments.push(makeWallRect(edge, room, cursor, length - cursor, thickness));
  return segments;
}

function makeWallRect(edge, room, offset, length, thickness) {
  if (edge.axis === "horizontal") {
    return { x: edge.x(room) + offset, y: edge.y(room) - thickness / 2, width: length, height: thickness };
  }
  return { x: edge.x(room) - thickness / 2, y: edge.y(room) + offset, width: thickness, height: length };
}

function makeCorridorWalls(corridor, thickness) {
  const sideWalls = corridor.walls.flatMap((side) => {
    const horizontal = side === "north" || side === "south";
    const length = horizontal ? corridor.width : corridor.height;
    const coordinate = horizontal
      ? corridor.y + (side === "south" ? corridor.height : 0)
      : corridor.x + (side === "east" ? corridor.width : 0);
    const origin = horizontal ? corridor.x : corridor.y;
    const openings = [...(corridor.doors?.[side] ?? [])].sort((a, b) => a.offset - b.offset);
    const segments = [];
    let cursor = 0;
    const addSegment = (start, segmentLength) => {
      if (segmentLength <= 0) return;
      segments.push(horizontal
        ? { x: origin + start, y: coordinate - thickness / 2, width: segmentLength, height: thickness }
        : { x: coordinate - thickness / 2, y: origin + start, width: thickness, height: segmentLength });
    };

    for (const opening of openings) {
      const start = Math.max(cursor, opening.offset);
      const end = Math.min(length, opening.offset + opening.width);
      addSegment(cursor, start - cursor);
      cursor = Math.max(cursor, end);
    }
    addSegment(cursor, length - cursor);
    return segments;
  });

  const endWalls = (corridor.endWalls ?? []).map((side) => {
    const y = side === "north" ? corridor.y : corridor.y + corridor.height;
    return {
      x: corridor.x - thickness / 2,
      y: y - thickness / 2,
      width: corridor.width + thickness,
      height: thickness,
    };
  });

  return [...sideWalls, ...endWalls];
}

function makeExtensionWalls(extension, thickness) {
  const walls = [];
  if (extension.openSide !== "north") {
    walls.push({ x: extension.x, y: extension.y - thickness / 2, width: extension.width, height: thickness });
  }
  if (extension.openSide !== "south") {
    walls.push({ x: extension.x, y: extension.y + extension.height - thickness / 2, width: extension.width, height: thickness });
  }
  if (extension.openSide !== "west") {
    walls.push({ x: extension.x - thickness / 2, y: extension.y, width: thickness, height: extension.height });
  }
  if (extension.openSide !== "east") {
    walls.push({ x: extension.x + extension.width - thickness / 2, y: extension.y, width: thickness, height: extension.height });
  }
  return walls;
}

// Convert the raw perpendicular wall rectangles into a non-overlapping set of
// orthogonal strips. This preserves their exact union while removing doubled
// corner blocks and seams. The same normalized rectangles drive drawing,
// collision, vision and navigation.
function normalizeWallRects(rectangles) {
  const ys = [...new Set(rectangles.flatMap((rect) => [rect.y, rect.y + rect.height]))].sort((a, b) => a - b);
  const strips = [];
  for (let row = 0; row < ys.length - 1; row += 1) {
    const y = ys[row];
    const bottom = ys[row + 1];
    if (bottom <= y) continue;
    const ranges = rectangles
      .filter((rect) => rect.y <= y && rect.y + rect.height >= bottom)
      .map((rect) => [rect.x, rect.x + rect.width])
      .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
      else merged.push([...range]);
    }
    for (const [x, right] of merged) strips.push({ x, y, width: right - x, height: bottom - y });
  }

  // Merge vertically adjacent strips with identical horizontal spans.
  const result = [];
  let previousRow = new Map();
  let rowY = null;
  let currentRow = new Map();
  for (const strip of strips) {
    if (rowY !== strip.y) {
      if (rowY !== null) previousRow = currentRow;
      rowY = strip.y;
      currentRow = new Map();
    }
    const key = `${strip.x}:${strip.width}`;
    const prior = previousRow.get(key);
    if (prior && prior.y + prior.height === strip.y) {
      prior.height += strip.height;
      currentRow.set(key, prior);
    } else {
      const rect = { ...strip };
      result.push(rect);
      currentRow.set(key, rect);
    }
  }
  return result;
}

export class House {
  constructor(data) {
    this.width = data.width;
    this.height = data.height;
    this.rooms = data.rooms;
    this.corridors = data.corridors;
    this.extensions = this.rooms.flatMap((room) => (room.extensions ?? []).map((extension) => ({
      ...extension,
      roomId: room.id,
      floor: room.floor,
      pattern: room.pattern,
    })));
    this.furniture = data.furniture;
    const entranceRoom = data.entranceDoor && this.rooms.find((room) => room.id === data.entranceDoor.roomId);
    this.entranceDoor = entranceRoom ? {
      ...data.entranceDoor,
      x: data.entranceDoor.side === "west" ? entranceRoom.x - data.wallThickness / 2 : entranceRoom.x + entranceRoom.width - data.wallThickness / 2,
      y: entranceRoom.y + data.entranceDoor.offset,
      width: data.wallThickness,
      height: data.entranceDoor.width,
      state: "closed",
    } : null;
    this.walkableAreas = [...this.rooms, ...this.corridors, ...this.extensions];
    this.doorways = this.rooms.flatMap((room) => Object.entries(room.doors ?? {}).flatMap(([side, doors]) =>
      doors.map((door) => ({ ...door, roomId: room.id, side, ...this.doorRect(room, side, door) })),
    ));

    const roomWalls = this.rooms.flatMap((room) => Object.entries(SIDES).flatMap(([side]) =>
      makeEdgeWalls(room, side, room.doors?.[side] ?? [], data.wallThickness),
    ));
    const extensionWalls = this.extensions.flatMap((extension) => makeExtensionWalls(extension, data.wallThickness));
    const corridorWalls = this.corridors.flatMap((corridor) => makeCorridorWalls(corridor, data.wallThickness));
    this.walls = normalizeWallRects([...roomWalls, ...extensionWalls, ...corridorWalls]).map((wall, index) => ({
      id: `wall-${index + 1}`,
      ...wall,
      blocksMovement: true,
      blocksVision: true,
    }));
    this.decorativeCollisionRects = LIVING_ROOM_DECOR_COLLISIONS;
    this.collisionRects = [
      ...this.walls,
      ...this.furniture.filter((item) => item.blocksMovement).map((item) => ({
        ...item,
        ...getFurnitureCollisionBounds(item),
      })),
      ...this.decorativeCollisionRects,
    ];
    this.visionOccluders = [
      ...this.walls,
      ...this.furniture.filter((item) => item.blocksVision).map((item) => ({
        ...item,
        ...getFurnitureCollisionBounds(item),
      })),
      ...this.decorativeCollisionRects.filter((item) => item.blocksVision),
    ];
  }

  doorRect(room, side, door) {
    if (side === "north" || side === "south") {
      return {
        x: room.x + door.offset,
        y: side === "north" ? room.y : room.y + room.height,
        width: door.width,
        height: 0,
      };
    }
    return {
      x: side === "west" ? room.x : room.x + room.width,
      y: room.y + door.offset,
      width: 0,
      height: door.width,
    };
  }

  isWalkablePoint(x, y) {
    return this.walkableAreas.some((area) =>
      x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height,
    );
  }

  canOccupyCircle(x, y, radius) {
    const samples = 16;
    if (!this.isWalkablePoint(x, y)) return false;
    for (let index = 0; index < samples; index += 1) {
      const angle = (index / samples) * Math.PI * 2;
      if (!this.isWalkablePoint(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
    }
    return !this.collisionRects.some((rect) => circleIntersectsRect(x, y, radius, rect));
  }

  isLineOfSightBlocked(startX, startY, endX, endY) {
    return this.visionOccluders.some((rect) => segmentIntersectsRect(startX, startY, endX, endY, rect));
  }

  getRoomAt(x, y) {
    return this.rooms.find((room) =>
      x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height,
    ) ?? this.extensions.find((extension) =>
      x >= extension.x && x <= extension.x + extension.width && y >= extension.y && y <= extension.y + extension.height,
    ) ?? null;
  }
}
