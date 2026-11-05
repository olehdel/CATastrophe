import { Mouse } from "../entities/Mouse.js";
import { NavigationGrid } from "./NavigationGrid.js";
import { MOUSE_CONFIG } from "./MouseConfig.js";
import { MOUSE_SPAWN_POINTS } from "../world/MouseSpawnData.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const randomBetween = (min, max) => min + Math.random() * (max - min);

export class MouseSystem {
  constructor(house, scoring, config = MOUSE_CONFIG, spawnPoints = MOUSE_SPAWN_POINTS) {
    this.house = house;
    this.scoring = scoring;
    this.config = config;
    this.spawnPoints = spawnPoints;
    this.navigation = new NavigationGrid(house, config.navigationCellSize, config.radius);
    this.nextMouseId = 1;
    this.clear();
    this.nextMouseId = 1;
  }

  reset(cat, oldLady) {
    this.mice = [];
    this.pendingSpawns = [];
    this.catchableMouse = null;
    this.blockFurnitureInteractionUntilRelease = false;
    this.notificationTimer = 0;
    this.lastReward = null;
    this.witnessedCatchMessage = "";
    this.witnessMessageRemaining = 0;
    this.catchEffect = null;
    this.tutorialMouseId = null;
    this.nextMouseId = 1;
    if (!cat || !oldLady) return;
    for (let index = 0; index < this.config.startingPopulation; index += 1) {
      if (!this.spawnMouse(cat, oldLady)) break;
    }
  }

  clear() {
    this.mice = [];
    this.pendingSpawns = [];
    this.catchableMouse = null;
    this.blockFurnitureInteractionUntilRelease = false;
    this.notificationTimer = 0;
    this.lastReward = null;
    this.witnessedCatchMessage = "";
    this.witnessMessageRemaining = 0;
    this.catchEffect = null;
    this.tutorialMouseId = null;
  }

  getSafeSpawnPoints(cat, oldLady) {
    return this.spawnPoints.filter((point) => {
      if (!this.house.canOccupyCircle(point.x, point.y, this.config.radius)) return false;
      if (cat && distance(point, cat) < this.config.spawnSafetyDistance) return false;
      if (oldLady && distance(point, oldLady) < this.config.spawnSafetyDistance) return false;
      return this.mice.every((mouse) => distance(point, mouse) >= this.config.spawnSeparation);
    });
  }

  spawnMouse(cat, oldLady) {
    if (this.mice.length >= this.config.maxActive) return false;
    const available = this.getSafeSpawnPoints(cat, oldLady);
    if (!available.length) return false;
    const spawn = available[Math.floor(Math.random() * available.length)];
    this.mice.push(new Mouse(`mouse-${this.nextMouseId++}`, spawn, this.config.radius));
    return true;
  }

  // The tutorial needs a mouse that is nearby, reachable, and guaranteed to
  // stay put until the player catches it. It is removed from play on catch and
  // the normal starting population is restored when the tutorial ends.
  beginTutorialMouse(cat) {
    this.endTutorialMouse();
    for (const radius of [120, 150, 180, 100, 210]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = (Math.PI * 2 * index) / 16 + Math.PI / 16;
        const x = cat.x + Math.cos(angle) * radius;
        const y = cat.y + Math.sin(angle) * radius;
        if (!this.house.canOccupyCircle(x, y, this.config.radius + 2)) continue;
        if (this.house.isLineOfSightBlocked(cat.x, cat.y, x, y)) continue;
        if (!this.navigation.findPath(cat.x, cat.y, x, y).length) continue;
        const mouse = new Mouse(`mouse-${this.nextMouseId++}`, { id: "tutorial", x, y }, this.config.radius);
        this.mice.push(mouse);
        this.tutorialMouseId = mouse.id;
        return true;
      }
    }
    const fallback = this.mice
      .slice()
      .sort((a, b) => distance(a, cat) - distance(b, cat))[0];
    if (!fallback) return false;
    this.tutorialMouseId = fallback.id;
    fallback.path = [];
    fallback.target = null;
    return true;
  }

  endTutorialMouse() {
    this.tutorialMouseId = null;
  }

  getTutorialMouse() {
    if (!this.tutorialMouseId) return null;
    return this.mice.find((mouse) => mouse.id === this.tutorialMouseId) ?? null;
  }

  finishTutorial(cat, oldLady) {
    const tutorialMouse = this.getTutorialMouse();
    this.endTutorialMouse();
    if (tutorialMouse && this.mice.length > this.config.startingPopulation) {
      this.mice = this.mice.filter((mouse) => mouse !== tutorialMouse);
    }
    if (!cat || !oldLady) return;
    while (this.mice.length < this.config.startingPopulation) {
      if (!this.spawnMouse(null, oldLady)) break;
    }
  }

  pickWanderTarget(mouse) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomBetween(45, this.config.wanderRadius);
      const x = mouse.homeX + Math.cos(angle) * radius;
      const y = mouse.homeY + Math.sin(angle) * radius;
      const path = this.navigation.findPath(mouse.x, mouse.y, x, y);
      if (!path.length) continue;
      mouse.target = path[path.length - 1];
      mouse.path = path;
      mouse.pathCursor = 0;
      mouse.goalTimer = randomBetween(1.5, 3.5);
      mouse.pauseTimer = 0;
      return true;
    }
    mouse.path = [];
    mouse.target = null;
    mouse.pauseTimer = randomBetween(this.config.wanderPauseMin, this.config.wanderPauseMax);
    return false;
  }

  pickFleeTarget(mouse, cat) {
    let dx = mouse.x - cat.x;
    let dy = mouse.y - cat.y;
    let magnitude = Math.hypot(dx, dy);
    if (magnitude < 1) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      magnitude = 1;
    }

    const distanceFromCat = Math.min(this.config.fleeDistance, this.config.detectionRadius + 45);
    for (const offset of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
      const angle = Math.atan2(dy, dx) + offset;
      const targetIndex = this.navigation.nearestIndex(
        mouse.x + Math.cos(angle) * distanceFromCat,
        mouse.y + Math.sin(angle) * distanceFromCat,
        7,
      );
      if (targetIndex < 0) continue;
      const target = this.navigation.toPoint(targetIndex);
      const path = this.navigation.findPath(mouse.x, mouse.y, target.x, target.y);
      if (!path.length) continue;
      mouse.target = target;
      mouse.path = path;
      mouse.pathCursor = 0;
      mouse.fleeRetargetTimer = this.config.fleeRetargetInterval;
      return true;
    }
    mouse.path = [];
    mouse.target = null;
    return false;
  }

  isCatchable(mouse, cat) {
    return distance(mouse, cat) <= this.config.catchRadius
      && !this.house.isLineOfSightBlocked(cat.x, cat.y, mouse.x, mouse.y);
  }

  findCatchableMouse(cat) {
    return this.mice
      .filter((mouse) => this.isCatchable(mouse, cat))
      .sort((a, b) => distance(a, cat) - distance(b, cat))[0] ?? null;
  }

  catchMouse(mouse, cat, { tutorial = false } = {}) {
    this.mice = this.mice.filter((activeMouse) => activeMouse !== mouse);
    const energy = Math.min(this.config.energyRestore, cat.getStatus().maxEnergy - cat.energy);
    if (!tutorial) {
      this.scoring.awardBonus(this.config.rewardScore);
      cat.restoreEnergy(this.config.energyRestore);
    }
    this.lastReward = tutorial ? null : { score: this.config.rewardScore, energy };
    this.notificationTimer = tutorial ? 0 : this.config.notificationDuration;
    this.witnessedCatchMessage = "";
    this.witnessMessageRemaining = 0;
    this.catchEffect = {
      x: mouse.x,
      y: mouse.y,
      elapsed: 0,
      duration: this.config.catchEffectDuration,
      timeBonus: tutorial ? 0 : this.config.timeBonusSeconds,
    };
    // Keep delayed respawns bounded. If several catches happen before room is
    // available, expired entries otherwise linger while the population is at
    // its cap and make this per-frame scan grow for the rest of the run.
    if (!tutorial && this.pendingSpawns.length < this.config.maxActive) {
      this.pendingSpawns.push(this.config.respawnDelay);
    }
    return { mouse, reward: this.lastReward ? { ...this.lastReward } : null };
  }

  setWitnessedCatch(message) {
    this.witnessedCatchMessage = typeof message === "string" ? message : "";
    this.witnessMessageRemaining = this.witnessedCatchMessage
      ? this.config.witnessMessageDuration
      : 0;
  }

  advanceRespawns(deltaSeconds, cat, oldLady) {
    for (let index = this.pendingSpawns.length - 1; index >= 0; index -= 1) {
      this.pendingSpawns[index] -= deltaSeconds;
      if (this.pendingSpawns[index] > 0 || this.mice.length >= this.config.maxActive) continue;
      if (this.spawnMouse(cat, oldLady)) this.pendingSpawns.splice(index, 1);
      else this.pendingSpawns[index] = 0.5;
    }
  }

  updateMouse(mouse, deltaSeconds, cat) {
    if (mouse.id === this.tutorialMouseId) {
      mouse.path = [];
      mouse.target = null;
      mouse.setMode("idle");
      mouse.faceToward(cat.x, cat.y);
      mouse.updateAnimation(deltaSeconds);
      return;
    }
    const catDistance = distance(mouse, cat);
    const fleeing = catDistance <= this.config.detectionRadius;
    if (fleeing) {
      mouse.setMode("fleeing");
      mouse.fleeRetargetTimer = Math.max(0, mouse.fleeRetargetTimer - deltaSeconds);
      if (mouse.fleeRetargetTimer === 0 || !mouse.path.length) this.pickFleeTarget(mouse, cat);
    } else {
      mouse.fleeRetargetTimer = 0;
      if (mouse.pauseTimer > 0) {
        mouse.pauseTimer = Math.max(0, mouse.pauseTimer - deltaSeconds);
        mouse.setMode("idle");
        mouse.updateAnimation(deltaSeconds);
        return;
      }
      if (!mouse.path.length || mouse.goalTimer <= 0) this.pickWanderTarget(mouse);
      mouse.goalTimer -= deltaSeconds;
      mouse.setMode("walking");
    }

    if (!mouse.path.length) {
      mouse.setMode("idle");
      mouse.pauseTimer = randomBetween(this.config.wanderPauseMin, this.config.wanderPauseMax);
      mouse.updateAnimation(deltaSeconds);
      return;
    }

    const speed = fleeing ? this.config.fleeSpeed : this.config.walkSpeed;
    const movement = this.navigation.moveAlongPath(mouse, mouse.path, mouse.pathCursor, speed, deltaSeconds);
    mouse.pathCursor = movement.cursor;
    mouse.stuckTimer = movement.blocked ? mouse.stuckTimer + deltaSeconds : 0;
    if (movement.moving) {
      const nextPoint = mouse.path[Math.min(mouse.pathCursor, mouse.path.length - 1)];
      if (nextPoint) mouse.faceToward(nextPoint.x, nextPoint.y);
    }
    if (mouse.stuckTimer >= this.config.goalRetryInterval) {
      mouse.path = [];
      mouse.target = null;
      mouse.stuckTimer = 0;
    } else if (mouse.pathCursor >= mouse.path.length) {
      mouse.path = [];
      mouse.target = null;
      if (!fleeing) mouse.pauseTimer = randomBetween(this.config.wanderPauseMin, this.config.wanderPauseMax);
    }
    mouse.updateAnimation(deltaSeconds);
  }

  update(deltaSeconds, cat, oldLady, input, { allowCatch = true, tutorial = false } = {}) {
    this.witnessMessageRemaining = Math.max(0, this.witnessMessageRemaining - deltaSeconds);
    if (this.witnessMessageRemaining === 0) this.witnessedCatchMessage = "";
    if (this.catchEffect) {
      this.catchEffect.elapsed += deltaSeconds;
      if (this.catchEffect.elapsed >= this.catchEffect.duration) this.catchEffect = null;
    }
    this.notificationTimer = Math.max(0, this.notificationTimer - deltaSeconds);
    if (this.notificationTimer === 0) {
      this.lastReward = null;
    }
    if (!input.isDown("KeyE")) this.blockFurnitureInteractionUntilRelease = false;

    const candidate = allowCatch ? this.findCatchableMouse(cat) : null;
    this.catchableMouse = candidate;
    if (candidate && input.isDown("KeyE")) {
      this.blockFurnitureInteractionUntilRelease = true;
      const caught = this.catchMouse(candidate, cat, { tutorial });
      this.catchableMouse = null;
      return { caught };
    }

    this.advanceRespawns(deltaSeconds, cat, oldLady);
    for (const mouse of this.mice) this.updateMouse(mouse, deltaSeconds, cat);
    this.catchableMouse = allowCatch ? this.findCatchableMouse(cat) : null;
    return { caught: null };
  }

  get blocksFurnitureInteraction() {
    return this.blockFurnitureInteractionUntilRelease;
  }

  getStatus() {
    const fadeDuration = Math.max(0.01, this.config.witnessMessageFadeDuration);
    const witnessMessageAlpha = this.witnessedCatchMessage
      ? Math.min(1, this.witnessMessageRemaining / fadeDuration)
      : 0;
    return {
      activeCount: this.mice.length,
      catchable: Boolean(this.catchableMouse),
      reward: this.notificationTimer > 0 ? this.lastReward : null,
      witnessMessage: this.witnessedCatchMessage,
      witnessMessageAlpha,
    };
  }
}
