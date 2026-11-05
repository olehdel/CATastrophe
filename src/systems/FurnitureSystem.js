import { segmentIntersectsRect } from "../core/Collision.js";
import { DAMAGE_STAGES, FURNITURE_DATA } from "../world/FurnitureData.js";
import {
  getFurnitureInteractionBounds,
  getFurnitureInteractionPromptGap,
  getFurnitureVisualBounds,
} from "../world/FurnitureBounds.js";

const INTERACTION_RANGE = 62;
const SCRATCH_NOISE_INTERVAL = 0.85;
const DAMAGE_EPSILON = 1e-9;
const SCRATCH_SPEED_MULTIPLIER = 1.4;

function closestPointOnRect(x, y, rect) {
  return {
    x: Math.max(rect.x, Math.min(x, rect.x + rect.width)),
    y: Math.max(rect.y, Math.min(y, rect.y + rect.height)),
  };
}

export class FurnitureSystem {
  constructor(house, scoring, noiseEvents, config = FURNITURE_DATA) {
    this.house = house;
    this.scoring = scoring;
    this.noiseEvents = noiseEvents;
    this.config = config;
    this.reset();
  }

  reset() {
    this.scoring.reset();
    this.states = new Map();
    for (const item of this.house.furniture) {
      const tuning = this.config[item.id];
      if (!tuning) throw new Error(`Missing furniture balance data for: ${item.id}`);
      this.states.set(item.id, {
        id: item.id,
        damage: 0,
        awardedScore: 0,
        completedStages: 0,
        stageProgress: 0,
        stage: DAMAGE_STAGES[0].id,
        noiseTimer: 0,
        tuning,
      });
    }
    // Room tracking is count based: each room reports how many of its
    // destructible furniture objects are fully destroyed. Rooms with no
    // destructible furniture (the hallway) stay in the display but opt out of
    // the seven-room completion total.
    this.roomProgressRooms = this.house.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      totalFurniture: 0,
    }));
    const roomProgressById = new Map(this.roomProgressRooms.map((room) => [room.id, room]));
    this.roomByFurniture = new Map();
    for (const item of this.house.furniture) {
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.height / 2;
      const room = this.house.rooms.find((candidate) =>
        centerX >= candidate.x && centerX <= candidate.x + candidate.width
        && centerY >= candidate.y && centerY <= candidate.y + candidate.height,
      );
      const roomEntry = room ? roomProgressById.get(room.id) : null;
      if (!roomEntry) continue;
      roomEntry.totalFurniture += 1;
      this.roomByFurniture.set(item.id, room.id);
    }
    // This map is the authoritative destructible-furniture set. Track unique
    // completions so Game can check the all-destroyed win in constant time.
    this.destroyedFurnitureIds = new Set();
    this.allFurnitureDestroyed = false;
    this.destructionEvents = [];
    this.target = null;
    this.activeTargetId = null;
    this.scratchHeld = false;
    this.lastScoreAward = 0;
  }

  getState(id) {
    return this.states.get(id) ?? null;
  }

  cancelInteraction(cat) {
    this.target = null;
    this.activeTargetId = null;
    this.scratchHeld = false;
    if (cat) cat.setAction(null);
  }

  getTarget(cat) {
    const candidates = [];
    for (const item of this.house.furniture) {
      const state = this.getState(item.id);
      if (state.stage === DAMAGE_STAGES[3].id) continue;
      const bounds = getFurnitureInteractionBounds(item);
      const visualBounds = getFurnitureVisualBounds(item);
      const point = closestPointOnRect(cat.x, cat.y, bounds);
      const distance = Math.hypot(point.x - cat.x, point.y - cat.y);
      if (distance > INTERACTION_RANGE) continue;
      const blocked = this.house.collisionRects.some((obstacle) =>
        obstacle.id !== item.id && segmentIntersectsRect(cat.x, cat.y, point.x, point.y, obstacle),
      );
      if (!blocked) candidates.push({
        item,
        state,
        point,
        distance,
        bounds,
        visualBounds,
        promptGap: getFurnitureInteractionPromptGap(item),
      });
    }
    // A solid object may sit on top of a non-blocking floor item such as the
    // living-room rug. Prefer that nearby solid target so the rug beneath the
    // table cannot swallow every interaction from the carpeted area.
    const coveredFloorTargets = new Set(candidates
      .filter((floorTarget) => !floorTarget.item.blocksMovement)
      .filter((floorTarget) => candidates.some((solidTarget) =>
        solidTarget.item.blocksMovement
        && solidTarget.distance <= INTERACTION_RANGE
        && solidTarget.bounds.x < floorTarget.bounds.x + floorTarget.bounds.width
        && solidTarget.bounds.x + solidTarget.bounds.width > floorTarget.bounds.x
        && solidTarget.bounds.y < floorTarget.bounds.y + floorTarget.bounds.height
        && solidTarget.bounds.y + solidTarget.bounds.height > floorTarget.bounds.y,
      ))
      .map((target) => target.item.id));
    const available = candidates.filter((candidate) => !coveredFloorTargets.has(candidate.item.id));
    available.sort((a, b) => a.distance - b.distance);
    return available[0] ?? null;
  }

  update(deltaSeconds, cat, input) {
    this.lastScoreAward = 0;
    this.target = this.getTarget(cat);
    this.scratchHeld = Boolean(this.target && input.isDown("KeyE"));
    if (!this.scratchHeld) {
      this.activeTargetId = null;
      cat.setAction(null);
      return;
    }

    const { item, state, point } = this.target;
    this.activeTargetId = item.id;
    cat.faceToward(point.x, point.y, deltaSeconds);
    cat.setAction("scratch");
    let remainingTime = deltaSeconds;
    while (remainingTime > 0 && state.completedStages < 3) {
      const completedThreshold = state.completedStages === 0
        ? 0
        : DAMAGE_STAGES[state.completedStages].threshold;
      const nextThreshold = DAMAGE_STAGES[state.completedStages + 1].threshold;
      const stageDuration = state.tuning.scratchSeconds * (nextThreshold - completedThreshold) / SCRATCH_SPEED_MULTIPLIER;
      const timeToComplete = stageDuration * (1 - state.stageProgress);
      const consumedTime = Math.min(remainingTime, timeToComplete);
      state.stageProgress += consumedTime / stageDuration;
      remainingTime -= consumedTime;
      state.damage = state.tuning.maxDurability * (
        completedThreshold + (nextThreshold - completedThreshold) * state.stageProgress
      );

      if (state.stageProgress >= 1 - DAMAGE_EPSILON) {
        state.completedStages += 1;
        state.stageProgress = 0;
        state.stage = DAMAGE_STAGES[state.completedStages].id;
        state.damage = state.tuning.maxDurability * nextThreshold;
        let destroyedNow = false;
        if (state.completedStages === 3 && !this.destroyedFurnitureIds.has(item.id)) {
          this.destroyedFurnitureIds.add(item.id);
          this.allFurnitureDestroyed = this.states.size > 0
            && this.destroyedFurnitureIds.size === this.states.size;
          destroyedNow = true;
        }
        if (remainingTime <= state.tuning.scratchSeconds * DAMAGE_EPSILON) remainingTime = 0;

        const scoreAtStage = state.completedStages === 3
          ? state.tuning.maxScore
          : Math.floor(state.tuning.maxScore * nextThreshold + DAMAGE_EPSILON);
        const scoreDelta = Math.min(state.tuning.maxScore - state.awardedScore,
          Math.max(0, scoreAtStage - state.awardedScore));
        if (scoreDelta > 0) {
          state.awardedScore += scoreDelta;
          this.lastScoreAward += this.scoring.award(scoreDelta);
        }
        if (destroyedNow) {
          const bounds = getFurnitureVisualBounds(item);
          this.destructionEvents.push({
            id: item.id,
            x: bounds.x + bounds.width / 2,
            y: bounds.y,
            points: state.awardedScore,
          });
        }
      }
    }

    state.noiseTimer += deltaSeconds;
    if (state.noiseTimer >= SCRATCH_NOISE_INTERVAL) {
      state.noiseTimer %= SCRATCH_NOISE_INTERVAL;
      this.noiseEvents.emit({
        type: "scratch",
        source: item.id,
        x: cat.x,
        y: cat.y,
        level: state.tuning.noiseLevel * 0.62,
      });
    }

    if (state.completedStages === 3) {
      this.noiseEvents.emit({
        type: "destroy",
        source: item.id,
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
        level: Math.min(1, Math.max(0.82, state.tuning.noiseLevel + 0.28)),
        urgent: true,
      });
      this.scratchHeld = false;
      this.activeTargetId = null;
      this.target = null;
      cat.setAction(null);
    }
  }

  // Tutorial scratching shows the target and the scratch animation without
  // touching damage, score, noise, or destruction progress. The real run starts
  // from a clean furniture state.
  updateTutorial(deltaSeconds, cat, input) {
    this.lastScoreAward = 0;
    this.target = this.getTarget(cat);
    this.scratchHeld = Boolean(this.target && input.isDown("KeyE"));
    if (!this.scratchHeld) {
      this.activeTargetId = null;
      cat.setAction(null);
      return;
    }
    this.activeTargetId = this.target.item.id;
    cat.faceToward(this.target.point.x, this.target.point.y, deltaSeconds);
    cat.setAction("scratch");
  }

  getStageProgress(id) {
    const state = this.getState(id);
    if (!state || state.stageProgress < DAMAGE_EPSILON) return 0;
    return Math.min(1, state.stageProgress);
  }

  getDamageProgress(id) {
    const state = this.getState(id);
    if (!state || state.tuning.maxDurability <= 0) return 0;
    return Math.max(0, Math.min(1, state.damage / state.tuning.maxDurability));
  }

  // Returns the newly destroyed furniture since the last call. Game forwards
  // each event to the visual effects layer exactly once.
  takeDestructionEvents() {
    if (this.destructionEvents.length === 0) return [];
    return this.destructionEvents.splice(0);
  }

  // Drop any destruction feedback that has not been consumed yet, so a capture
  // cannot replay stale destruction noise or popups after the cat respawns.
  discardDestructionEvents() {
    this.destructionEvents.length = 0;
  }

  // Room progress is based on fully destroyed furniture only. Partial damage
  // does not change a room's state, and each object contributes at most once.
  getRoomProgress() {
    const countsByRoom = new Map();
    for (const state of this.states.values()) {
      const roomId = this.roomByFurniture.get(state.id);
      if (!roomId) continue;
      const counts = countsByRoom.get(roomId) ?? { total: 0, destroyed: 0 };
      counts.total += 1;
      if (state.completedStages >= 3) counts.destroyed += 1;
      countsByRoom.set(roomId, counts);
    }
    return this.roomProgressRooms.map((room) => {
      const counts = countsByRoom.get(room.id) ?? { total: 0, destroyed: 0 };
      const totalFurniture = counts.total;
      const destroyedFurniture = counts.destroyed;
      const progress = totalFurniture > 0 ? destroyedFurniture / totalFurniture : 0;
      return {
        id: room.id,
        name: room.name,
        totalFurniture,
        destroyedFurniture,
        progress,
        percent: Math.round(progress * 100),
        complete: totalFurniture > 0 && destroyedFurniture >= totalFurniture,
        destructible: totalFurniture > 0,
      };
    });
  }

  getScore() {
    return this.scoring.total;
  }
}
