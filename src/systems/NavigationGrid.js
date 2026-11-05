import { moveCircleWithCollision } from "../core/Collision.js";

const GRID_DIRECTIONS = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
]);

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].score <= item.score) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (this.items.length === 0) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        let child = left;
        if (right < this.items.length && this.items[right].score < this.items[left].score) child = right;
        if (this.items[child].score >= last.score) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }

  get size() {
    return this.items.length;
  }
}

export class NavigationGrid {
  constructor(house, cellSize = 20, radius = 18) {
    this.house = house;
    this.cellSize = cellSize;
    this.radius = radius;
    this.columns = Math.ceil(house.width / cellSize);
    this.rows = Math.ceil(house.height / cellSize);
    this.valid = new Uint8Array(this.columns * this.rows);
    this.build();
  }

  build() {
    this.valid.fill(0);
    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const index = this.toIndex(column, row);
        const point = this.toPoint(index);
        if (this.house.canOccupyCircle(point.x, point.y, this.radius)) this.valid[index] = 1;
      }
    }
    this.connections = Array.from({ length: this.valid.length }, () => []);
    for (let index = 0; index < this.valid.length; index += 1) {
      if (!this.valid[index]) continue;
      const column = index % this.columns;
      const row = Math.floor(index / this.columns);
      for (const [dx, dy] of GRID_DIRECTIONS) {
        const neighbor = this.toIndex(column + dx, row + dy);
        if (neighbor < 0 || !this.valid[neighbor]) continue;
        if (dx !== 0 && dy !== 0) {
          const horizontal = this.toIndex(column + dx, row);
          const vertical = this.toIndex(column, row + dy);
          if (horizontal < 0 || vertical < 0 || !this.valid[horizontal] || !this.valid[vertical]) continue;
        }
        if (this.canTraverse(index, neighbor)) this.connections[index].push(neighbor);
      }
    }
  }

  toIndex(column, row) {
    if (column < 0 || column >= this.columns || row < 0 || row >= this.rows) return -1;
    return row * this.columns + column;
  }

  toPoint(index) {
    return {
      x: (index % this.columns) * this.cellSize + this.cellSize / 2,
      y: Math.floor(index / this.columns) * this.cellSize + this.cellSize / 2,
    };
  }

  canTraverse(fromIndex, toIndex) {
    const from = this.toPoint(fromIndex);
    const to = this.toPoint(toIndex);
    const result = moveCircleWithCollision(
      from.x,
      from.y,
      this.radius,
      to.x - from.x,
      to.y - from.y,
      this.house,
    );
    return Math.hypot(result.x - to.x, result.y - to.y) <= 1;
  }

  nearestIndex(x, y, maxRadius = 12) {
    const column = Math.max(0, Math.min(this.columns - 1, Math.floor(x / this.cellSize)));
    const row = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)));
    for (let radius = 0; radius <= maxRadius; radius += 1) {
      let closest = -1;
      let closestDistance = Infinity;
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const index = this.toIndex(column + dx, row + dy);
          if (index < 0 || !this.valid[index]) continue;
          const point = this.toPoint(index);
          const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
          if (distance < closestDistance) {
            closest = index;
            closestDistance = distance;
          }
        }
      }
      if (closest >= 0) return closest;
    }
    return -1;
  }

  findPath(startX, startY, targetX, targetY, options = {}) {
    const start = this.nearestIndex(startX, startY);
    const goal = this.nearestIndex(targetX, targetY);
    if (start < 0 || goal < 0) return [];
    if (start === goal) return [this.toPoint(goal)];

    const count = this.valid.length;
    const costs = new Float32Array(count);
    costs.fill(Infinity);
    costs[start] = 0;
    const parents = new Int32Array(count);
    parents.fill(-1);
    const closed = new Uint8Array(count);
    const open = new MinHeap();
    const goalXCell = goal % this.columns;
    const goalYCell = Math.floor(goal / this.columns);
    const heuristic = (index) => {
      const dx = Math.abs(index % this.columns - goalXCell);
      const dy = Math.abs(Math.floor(index / this.columns) - goalYCell);
      return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
    };
    open.push({ index: start, score: heuristic(start) });

    while (open.size > 0) {
      const entry = open.pop();
      const current = entry.index;
      if (closed[current]) continue;
      if (current === goal) return this.reconstructPath(parents, start, goal);
      closed[current] = 1;

      for (const neighbor of this.connections[current]) {
        if (closed[neighbor]) continue;
        const columnDelta = Math.abs(current % this.columns - neighbor % this.columns);
        const rowDelta = Math.abs(Math.floor(current / this.columns) - Math.floor(neighbor / this.columns));
        const point = this.toPoint(neighbor);
        const avoidPenalty = (options.avoidPoints ?? []).reduce((penalty, avoidPoint) => {
          const distance = Math.hypot(point.x - avoidPoint.x, point.y - avoidPoint.y);
          const radius = options.avoidRadius ?? 0;
          if (radius <= 0 || distance >= radius) return penalty;
          return penalty + (options.avoidPenalty ?? 0) * (1 - distance / radius);
        }, 0);
        const nextCost = costs[current]
          + (columnDelta !== 0 && rowDelta !== 0 ? Math.SQRT2 : 1)
          + avoidPenalty;
        if (nextCost >= costs[neighbor]) continue;
        costs[neighbor] = nextCost;
        parents[neighbor] = current;
        open.push({ index: neighbor, score: nextCost + heuristic(neighbor) });
      }
    }
    return [];
  }

  findPathToNearestReachable(startX, startY, targetX, targetY) {
    const start = this.nearestIndex(startX, startY);
    if (start < 0) return [];

    const parent = new Int32Array(this.valid.length);
    parent.fill(-1);
    const visited = new Uint8Array(this.valid.length);
    const queue = new Int32Array(this.valid.length);
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    let best = start;
    let bestDistance = (this.toPoint(start).x - targetX) ** 2 + (this.toPoint(start).y - targetY) ** 2;
    while (head < tail) {
      const current = queue[head++];
      const point = this.toPoint(current);
      const distance = (point.x - targetX) ** 2 + (point.y - targetY) ** 2;
      if (distance < bestDistance) {
        best = current;
        bestDistance = distance;
      }

      for (const neighbor of this.connections[current]) {
        if (visited[neighbor]) continue;
        visited[neighbor] = 1;
        parent[neighbor] = current;
        queue[tail++] = neighbor;
      }
    }

    if (best === start) return [this.toPoint(start)];
    return this.reconstructPath(parent, start, best);
  }

  reconstructPath(parents, start, goal) {
    const path = [];
    let current = goal;
    while (current !== start && current >= 0) {
      path.push(this.toPoint(current));
      current = parents[current];
    }
    if (current !== start) return [];
    path.reverse();
    return path;
  }

  moveAlongPath(entity, path, cursor, speed, deltaSeconds) {
    let nextCursor = cursor;
    while (nextCursor < path.length) {
      const waypoint = path[nextCursor];
      if (Math.hypot(waypoint.x - entity.x, waypoint.y - entity.y) > 5) break;
      nextCursor += 1;
    }
    if (nextCursor >= path.length) return { cursor: nextCursor, moving: false };

    const waypoint = path[nextCursor];
    const deltaX = waypoint.x - entity.x;
    const deltaY = waypoint.y - entity.y;
    const distance = Math.hypot(deltaX, deltaY);
    const travel = Math.min(distance, speed * deltaSeconds);
    entity.faceToward(waypoint.x, waypoint.y, deltaSeconds);
    const result = moveCircleWithCollision(
      entity.x,
      entity.y,
      entity.radius,
      (deltaX / distance) * travel,
      (deltaY / distance) * travel,
      this.house,
    );
    entity.x = result.x;
    entity.y = result.y;
    return { cursor: nextCursor, moving: true, blocked: result.collidedX || result.collidedY };
  }
}
