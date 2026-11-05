import { segmentIntersectsRect } from "../core/Collision.js";
import { NavigationGrid } from "./NavigationGrid.js";
import { OLD_LADY_CONFIG } from "./OldLadyConfig.js";

export const OLD_LADY_STATES = Object.freeze({
  NORMAL: "NORMAL",
  SUSPICIOUS: "SUSPICIOUS",
  SEARCHING: "SEARCHING",
  CHASING: "CHASING",
});

const SEARCH_OFFSETS = Object.freeze([
  { x: 0, y: 0 },
  { x: 48, y: 0 },
  { x: 34, y: 34 },
  { x: 0, y: 48 },
  { x: -34, y: 34 },
  { x: -48, y: 0 },
  { x: -34, y: -34 },
  { x: 0, y: -48 },
  { x: 34, y: -34 },
  { x: 86, y: 42 },
  { x: -86, y: 42 },
  { x: 86, y: -42 },
  { x: -86, y: -42 },
]);

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class OldLadyAI {
  constructor(lady, house, noiseEvents, patrolRoute, config = OLD_LADY_CONFIG) {
    this.lady = lady;
    this.house = house;
    this.noiseEvents = noiseEvents;
    this.patrolRoute = patrolRoute;
    this.config = config;
    this.navigation = new NavigationGrid(house, config.navigationCellSize, lady.radius);
    this.unsubscribeNoise = noiseEvents.subscribe((event) => this.onNoise(event));
    this.reset();
  }

  reset() {
    this.state = OLD_LADY_STATES.NORMAL;
    this.suspicion = 0;
    this.detectionProgress = 0;
    this.angerRemaining = 0;
    this.curiosityTimer = 0;
    this.catVisibleLastFrame = false;
    this.targetLocation = null;
    this.lastHeardNoise = null;
    this.noiseReactionDuration = 0;
    this.searchingAtSource = false;
    this.lastKnownCatPosition = null;
    this.investigationSource = null;
    this.destructionInvestigationActive = false;
    this.destructionInvestigationPending = false;
    this.mouseReactionTimer = 0;
    this.lastMouseCatchPhrase = null;
    this.patrolIndex = 0;
    this.stateTimer = 0;
    this.stateEntryAngle = this.lady.facingAngle;
    this.patrolPause = this.patrolRoute[0]?.pauseSeconds ?? this.config.patrolPauseMin;
    this.searchTimer = 0;
    this.chaseTimer = 0;
    this.chasingLastKnown = false;
    this.searchIndex = 0;
    this.path = [];
    this.pathCursor = 0;
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
    this.lastProgressPosition = null;
    this.recoveryCooldown = 0;
    this.unreachableRetryTimer = 0;
    this.recoveryAvoidPoints = [];
    this.recoveryAttempts = 0;
    this.pathFallback = false;
    this.lady.reset(this.patrolRoute[0] ?? { x: 560, y: 320 });
  }

  getNoiseHearing(event) {
    const source = { x: event.x, y: event.y };
    const distance = distanceBetween(this.lady, source);
    const crossedWalls = this.house.walls.reduce((count, wall) =>
      count + Number(segmentIntersectsRect(this.lady.x, this.lady.y, event.x, event.y, wall)), 0);
    const attenuation = this.config.hearingWallAttenuation ** Math.min(
      crossedWalls,
      this.config.maxHearingWallCrossings,
    );
    const effectiveLevel = event.level * attenuation;
    const intensityFactor = this.config.hearingIntensityFloor
      + (1 - this.config.hearingIntensityFloor) * Math.sqrt(event.level);
    const typeRangeMultiplier = this.config.hearingNoiseMultipliers[event.type] ?? 1;
    const hearingDistance = this.config.hearingRange * typeRangeMultiplier * intensityFactor * attenuation;
    return {
      source,
      distance,
      effectiveLevel,
      hearingDistance,
      heard: effectiveLevel >= this.config.minimumHeardNoiseLevel && distance <= hearingDistance,
    };
  }

  addNoiseSuspicion(event, hearing) {
    if (!hearing.heard) return;
    const proximity = Math.max(0, 1 - hearing.distance / Math.max(1, hearing.hearingDistance));
    const suspicionMultiplier = this.config.noiseSuspicionMultipliers[event.type] ?? 1;
    this.suspicion = Math.min(100,
      this.suspicion + this.config.suspicionPerNoise * suspicionMultiplier
        * hearing.effectiveLevel * (0.65 + proximity * 0.7));
  }

  onNoise(event) {
    const hearing = this.getNoiseHearing(event);
    const source = hearing.source;

    // Destruction is an explicit urgent event, not just a louder ordinary sound.
    // It must not be dropped by range or wall attenuation; pathfinding still
    // determines the closest location Grandma can safely reach.
    if (event.type === "destroy" && event.urgent !== false) {
      this.addNoiseSuspicion(event, hearing);
      // Every full destruction angers Grandma for a fixed window. Another
      // destruction refreshes that window, even while she is already chasing.
      this.angerRemaining = this.config.angerDuration;
      if (this.state === OLD_LADY_STATES.CHASING) return;
      this.targetLocation = source;
      this.investigationSource = "noise";
      this.lastHeardNoise = { source: event.source, type: event.type };
      this.noiseReactionDuration = 0;
      this.recoveryAvoidPoints = [];
      this.recoveryAttempts = 0;
      this.recoveryCooldown = 0;
      this.destructionInvestigationActive = true;
      this.destructionInvestigationPending = true;
      this.searchingAtSource = false;
      this.searchTimer = 0;
      this.lady.facingAngle = Math.atan2(event.y - this.lady.y, event.x - this.lady.x);
      if (this.state !== OLD_LADY_STATES.SEARCHING) this.transition(OLD_LADY_STATES.SEARCHING);
      else {
        this.clearPath();
        this.searchIndex = 0;
      }
      return;
    }

    if (!hearing.heard) return;

    this.addNoiseSuspicion(event, hearing);
    if (this.state === OLD_LADY_STATES.CHASING) return;

    // Keep the urgent destruction target while the search is active. Ordinary
    // scratch sounds still raise suspicion but must not pull Grandma off course.
    if (this.destructionInvestigationActive) return;

    const previousTarget = this.targetLocation;
    const sameNoiseSource = this.investigationSource === "noise"
      && this.lastHeardNoise?.source === event.source
      && distanceBetween(source, previousTarget ?? source) <= this.config.noiseRetargetDistance
      && !(event.type === "destroy" && this.lastHeardNoise.type !== "destroy");
    this.targetLocation = source;
    this.investigationSource = "noise";
    this.lastHeardNoise = { source: event.source, type: event.type };
    if (sameNoiseSource) {
      if (this.state === OLD_LADY_STATES.SEARCHING) this.searchTimer = this.config.searchDuration;
      return;
    }

    this.recoveryAvoidPoints = [];
    this.recoveryAttempts = 0;
    this.recoveryCooldown = 0;
    this.noiseReactionDuration = this.config.noiseReactionDurations[event.type]
      ?? this.config.noiseReactionDurations.scratch;
    this.searchingAtSource = false;
    this.lady.facingAngle = Math.atan2(event.y - this.lady.y, event.x - this.lady.x);
    this.stateTimer = 0;
    if (this.state !== OLD_LADY_STATES.SUSPICIOUS) this.transition(OLD_LADY_STATES.SUSPICIOUS);
    else this.clearPath();
  }

  // A successful capture ends the encounter cleanly. Anger alone is not
  // enough: stale detection progress or a remembered cat position would let
  // Grandma re-acquire the cat the instant the respawn grace period ends.
  resetAfterCapture() {
    this.angerRemaining = 0;
    this.state = OLD_LADY_STATES.NORMAL;
    this.suspicion = 0;
    this.detectionProgress = 0;
    this.curiosityTimer = 0;
    this.catVisibleLastFrame = false;
    this.targetLocation = null;
    this.lastKnownCatPosition = null;
    this.investigationSource = null;
    this.lastHeardNoise = null;
    this.noiseReactionDuration = 0;
    this.searchingAtSource = false;
    this.destructionInvestigationActive = false;
    this.destructionInvestigationPending = false;
    this.stateTimer = 0;
    this.stateEntryAngle = this.lady.facingAngle;
    this.searchTimer = 0;
    this.chaseTimer = 0;
    this.chasingLastKnown = false;
    this.searchIndex = 0;
    this.patrolPause = 0;
    this.clearPath();
  }

  transition(nextState) {
    if (this.state === nextState) return;
    this.state = nextState;
    this.stateTimer = 0;
    this.stateEntryAngle = this.lady.facingAngle;
    this.clearPath();
    this.recoveryAvoidPoints = [];
    this.recoveryAttempts = 0;
    this.recoveryCooldown = 0;
    if (nextState === OLD_LADY_STATES.SEARCHING) {
      this.searchTimer = this.config.searchDuration;
      this.searchIndex = 0;
      this.searchingAtSource = false;
    } else if (nextState === OLD_LADY_STATES.CHASING) {
      this.chaseTimer = this.config.chaseDuration;
      this.chasingLastKnown = false;
      this.investigationSource = "cat";
      this.destructionInvestigationActive = false;
      this.destructionInvestigationPending = false;
    } else if (nextState === OLD_LADY_STATES.NORMAL) {
      this.targetLocation = null;
      this.investigationSource = null;
      this.lastHeardNoise = null;
      this.noiseReactionDuration = 0;
      this.searchingAtSource = false;
      this.destructionInvestigationActive = false;
      this.destructionInvestigationPending = false;
    }
  }

  clearPath() {
    this.path = [];
    this.pathCursor = 0;
    this.pathGoal = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
    this.lastProgressPosition = null;
    this.unreachableRetryTimer = 0;
    this.pathFallback = false;
  }

  reactToMouseCatch(cat, mouse) {
    if (!mouse || !this.getVisibility(cat).visible || !this.getVisibility(mouse).visible) return null;
    this.mouseReactionTimer = this.config.mouseGoodDeedDuration;
    const phrases = this.config.mouseCatchPhrases ?? [];
    if (phrases.length === 0) return null;
    const alternatives = phrases.filter((phrase) => phrase !== this.lastMouseCatchPhrase);
    const choices = alternatives.length > 0 ? alternatives : phrases;
    const phrase = choices[Math.floor(Math.random() * choices.length)];
    this.lastMouseCatchPhrase = phrase;
    return phrase;
  }

  getVisibility(cat) {
    const deltaX = cat.x - this.lady.x;
    const deltaY = cat.y - this.lady.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > this.config.visionDistance) {
      return { visible: false, distance, modifier: 0, clip: "idle", suspicious: false };
    }

    const angleToCat = Math.atan2(deltaY, deltaX);
    const angleDifference = Math.atan2(Math.sin(angleToCat - this.lady.facingAngle), Math.cos(angleToCat - this.lady.facingAngle));
    const halfAngle = (this.config.visionAngleDegrees * Math.PI / 180) / 2;
    if (Math.abs(angleDifference) > halfAngle) {
      return { visible: false, distance, modifier: 0, clip: "idle", suspicious: false };
    }
    if (this.house.isLineOfSightBlocked(this.lady.x, this.lady.y, cat.x, cat.y)) {
      return { visible: false, distance, modifier: 0, clip: "idle", suspicious: false };
    }

    const clip = cat.getAnimationState?.().clip ?? cat.action ?? cat.mode ?? "idle";
    const modifier = this.config.visionModifiers[clip] ?? 0;
    const suspicious = this.config.suspiciousActions.includes(clip);
    return { visible: true, distance, modifier, clip, suspicious };
  }

  updateDetection(deltaSeconds, cat) {
    const visibility = this.getVisibility(cat);
    if (visibility.visible && visibility.suspicious) {
      const distanceFactor = 0.55 + 0.45 * (1 - visibility.distance / this.config.visionDistance);
      this.detectionProgress = Math.min(1,
        this.detectionProgress + this.config.detectionSpeed * visibility.modifier * distanceFactor * deltaSeconds);
      const suspicionRate = this.config.visualSuspicionRates[visibility.clip] ?? 0;
      this.suspicion = Math.min(100, this.suspicion + suspicionRate * deltaSeconds);
      this.lastKnownCatPosition = { x: cat.x, y: cat.y };
      this.targetLocation = { ...this.lastKnownCatPosition };
      this.investigationSource = "cat";
      this.curiosityTimer = 0;
      if (this.state === OLD_LADY_STATES.CHASING) this.chasingLastKnown = false;
      if (this.state === OLD_LADY_STATES.NORMAL || this.state === OLD_LADY_STATES.SEARCHING) {
        this.transition(OLD_LADY_STATES.SUSPICIOUS);
      }
      if (this.detectionProgress >= 1) this.transition(OLD_LADY_STATES.CHASING);
      this.catVisibleLastFrame = true;
    } else {
      this.detectionProgress = Math.max(0, this.detectionProgress - this.config.detectionDecay * deltaSeconds);
      this.suspicion = Math.max(0, this.suspicion - this.config.suspicionDecay * deltaSeconds);

      if (visibility.visible) {
        if (!this.catVisibleLastFrame && this.state === OLD_LADY_STATES.NORMAL) {
          this.curiosityTimer = this.config.curiosityDuration;
        }
        if (this.state === OLD_LADY_STATES.CHASING) {
          this.lastKnownCatPosition = { x: cat.x, y: cat.y };
          this.targetLocation = { ...this.lastKnownCatPosition };
          this.investigationSource = "cat";
          this.chasingLastKnown = false;
        }
        this.catVisibleLastFrame = true;
      } else {
        this.curiosityTimer = 0;
        this.catVisibleLastFrame = false;
      }

      if (this.state === OLD_LADY_STATES.CHASING && !this.chasingLastKnown) {
        this.targetLocation = this.lastKnownCatPosition
          ? { ...this.lastKnownCatPosition }
          : { x: this.lady.x, y: this.lady.y };
        this.investigationSource = "cat";
        this.chasingLastKnown = true;
        this.chaseTimer = this.config.chaseDuration;
        this.clearPath();
      }
    }
    return visibility;
  }

  planPath(target, nearestReachable = false) {
    const pathOptions = this.recoveryAvoidPoints.length > 0
      ? {
          avoidPoints: this.recoveryAvoidPoints,
          avoidRadius: this.config.stuckAvoidRadius,
          avoidPenalty: this.config.stuckAvoidPenalty,
        }
      : {};
    let path = nearestReachable
      ? this.navigation.findPathToNearestReachable(this.lady.x, this.lady.y, target.x, target.y)
      : this.navigation.findPath(this.lady.x, this.lady.y, target.x, target.y, pathOptions);
    this.pathFallback = nearestReachable;
    if (path.length === 0) {
      // A target may be inside an obstacle or in a disconnected component.
      // Walk to the closest cell reachable from Grandma's current component.
      path = this.navigation.findPathToNearestReachable(this.lady.x, this.lady.y, target.x, target.y);
      this.pathFallback = path.length > 0;
    }
    this.path = path;
    this.pathCursor = 0;
    this.pathGoal = { x: target.x, y: target.y };
    this.lastProgressPosition = { x: this.lady.x, y: this.lady.y };
    this.stuckTimer = 0;
    this.repathTimer = this.pathFallback
      ? this.config.unreachableRetryCooldown
      : this.config.pathReplanInterval;
    this.unreachableRetryTimer = path.length === 0 ? this.config.unreachableRetryCooldown : 0;
  }

  recoverFromStuck(target) {
    const stuckPoint = { x: this.lady.x, y: this.lady.y };
    const previous = this.recoveryAvoidPoints.at(-1);
    this.recoveryAttempts += 1;
    if (!previous || distanceBetween(previous, stuckPoint) > this.config.navigationCellSize) {
      this.recoveryAvoidPoints.push(stuckPoint);
      this.recoveryAvoidPoints = this.recoveryAvoidPoints.slice(-this.config.maxRecoveryAvoidPoints);
    }

    // Try an alternate route around recent blockage locations. If that route
    // cannot be built, use a reachable fallback and retry the real destination
    // after a cooldown instead of pushing into the obstacle indefinitely.
    const exhaustedRecoveryOptions = this.recoveryAttempts > this.config.maxRecoveryAttempts;
    if (exhaustedRecoveryOptions) this.recoveryAvoidPoints = [];
    this.planPath(target, exhaustedRecoveryOptions);
    this.recoveryCooldown = this.config.stuckReplanCooldown;
    this.repathTimer = Math.max(this.repathTimer, this.config.stuckReplanCooldown);
  }

  moveTo(target, deltaSeconds, speed, arrivalRadius = this.config.arrivalRadius, animationMode = null, nearestReachable = false) {
    if (!target || distanceBetween(this.lady, target) <= arrivalRadius) {
      this.lady.updateAnimation(deltaSeconds, false);
      return true;
    }

    this.repathTimer = Math.max(0, this.repathTimer - deltaSeconds);
    this.recoveryCooldown = Math.max(0, this.recoveryCooldown - deltaSeconds);
    this.unreachableRetryTimer = Math.max(0, this.unreachableRetryTimer - deltaSeconds);
    const goalMoved = !this.pathGoal || distanceBetween(this.pathGoal, target) > this.config.navigationCellSize * 0.6;
    const shouldPlan = goalMoved && this.repathTimer <= 0
      || this.path.length === 0 && this.repathTimer <= 0 && this.unreachableRetryTimer <= 0;
    if (shouldPlan) {
      this.planPath(target, nearestReachable);
    }

    const movement = this.navigation.moveAlongPath(this.lady, this.path, this.pathCursor, speed, deltaSeconds);
    this.pathCursor = movement.cursor;
    const movedDistance = this.lastProgressPosition
      ? distanceBetween(this.lady, this.lastProgressPosition)
      : 0;
    if (movedDistance >= this.config.stuckProgressDistance) {
      this.lastProgressPosition = { x: this.lady.x, y: this.lady.y };
      this.stuckTimer = 0;
      if (this.recoveryAvoidPoints.length > 0 && !movement.blocked) {
        this.recoveryAvoidPoints = this.recoveryAvoidPoints.filter((point) =>
          distanceBetween(point, this.lady) > this.config.stuckAvoidRadius);
        if (this.recoveryAvoidPoints.length === 0) this.recoveryAttempts = 0;
      }
    } else if (this.path.length > 0) {
      this.stuckTimer += deltaSeconds;
    }
    if (this.stuckTimer >= this.config.stuckReplanTime && this.recoveryCooldown <= 0) {
      this.recoverFromStuck(target);
    }
    this.lady.updateAnimation(
      deltaSeconds,
      movement.moving,
      animationMode ?? (speed >= this.config.chaseSpeed ? "run" : "walk"),
    );

    const pathFinished = this.pathCursor >= this.path.length;
    const hasPath = this.path.length > 0;
    if (pathFinished && hasPath) {
      this.path = [];
      this.pathCursor = 0;
      this.pathGoal = { x: target.x, y: target.y };
      this.lastProgressPosition = { x: this.lady.x, y: this.lady.y };
      this.stuckTimer = 0;
      this.repathTimer = Math.max(this.repathTimer, this.pathFallback
        ? this.config.unreachableRetryCooldown
        : this.config.pathReplanInterval);
    }
    return pathFinished && hasPath;
  }

  updatePatrol(deltaSeconds) {
    const waypoint = this.patrolRoute[this.patrolIndex];
    if (!waypoint) return;
    if (this.patrolPause > 0) {
      this.patrolPause = Math.max(0, this.patrolPause - deltaSeconds);
      this.lady.updateAnimation(deltaSeconds, false);
      return;
    }
    if (this.moveTo(waypoint, deltaSeconds, this.config.movementSpeed)) {
      this.patrolPause = Math.min(this.config.patrolPauseMax,
        Math.max(this.config.patrolPauseMin, waypoint.pauseSeconds ?? this.config.patrolPauseMin));
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolRoute.length;
    }
  }

  updateSearching(deltaSeconds) {
    if (!this.targetLocation) {
      this.transition(OLD_LADY_STATES.NORMAL);
      return;
    }

    if (!this.searchingAtSource) {
      const destructionTrip = this.destructionInvestigationPending;
      const speed = destructionTrip ? this.config.destructionInvestigationSpeed : this.config.movementSpeed;
      const arrivalRadius = destructionTrip ? this.config.destructionArrivalRadius : this.config.searchArrivalRadius;
      if (this.moveTo(this.targetLocation, deltaSeconds, speed, arrivalRadius,
        destructionTrip ? "run" : null, destructionTrip)) {
        this.destructionInvestigationPending = false;
        this.searchingAtSource = true;
        this.searchTimer = destructionTrip ? this.config.destructionSearchDuration : this.config.searchDuration;
        this.searchIndex = 1;
        this.clearPath();
      }
      return;
    }

    this.searchTimer -= deltaSeconds;
    if (this.searchTimer <= 0) {
      this.transition(OLD_LADY_STATES.NORMAL);
      return;
    }

    const offset = SEARCH_OFFSETS[this.searchIndex % SEARCH_OFFSETS.length];
    const point = { x: this.targetLocation.x + offset.x, y: this.targetLocation.y + offset.y };
    if (this.moveTo(point, deltaSeconds, this.config.movementSpeed, this.config.searchArrivalRadius, null, this.destructionInvestigationActive)) {
      this.searchIndex += 1;
      this.clearPath();
    }
  }

  update(deltaSeconds, cat) {
    this.angerRemaining = Math.max(0, this.angerRemaining - deltaSeconds);
    if (this.mouseReactionTimer > 0) {
      this.mouseReactionTimer = Math.max(0, this.mouseReactionTimer - deltaSeconds);
      this.lady.faceToward(cat.x, cat.y, deltaSeconds);
      this.lady.updateAnimation(deltaSeconds, false);
      return;
    }
    const visibility = this.updateDetection(deltaSeconds, cat);
    // While angry, any clear sight of the cat starts a chase immediately,
    // bypassing the normal detection-progress gate. Expiry only stops new
    // instant chases; it never cancels a chase that is already underway.
    if (this.angerRemaining > 0 && visibility.visible && this.state !== OLD_LADY_STATES.CHASING) {
      this.lastKnownCatPosition = { x: cat.x, y: cat.y };
      this.targetLocation = { ...this.lastKnownCatPosition };
      this.investigationSource = "cat";
      this.transition(OLD_LADY_STATES.CHASING);
    }
    this.stateTimer += deltaSeconds;

    if (this.state === OLD_LADY_STATES.NORMAL) {
      if (visibility.visible && this.curiosityTimer > 0) {
        this.lady.faceToward(cat.x, cat.y, deltaSeconds);
        this.curiosityTimer = Math.max(0, this.curiosityTimer - deltaSeconds);
      }
      this.updatePatrol(deltaSeconds);
    } else if (this.state === OLD_LADY_STATES.SUSPICIOUS) {
      if (this.investigationSource === "noise" && this.targetLocation) {
        this.lady.faceToward(this.targetLocation.x, this.targetLocation.y, deltaSeconds);
      } else if (visibility.visible) this.lady.faceToward(cat.x, cat.y, deltaSeconds);
      else this.lady.facingAngle = this.stateEntryAngle + Math.sin(this.stateTimer * 3.2) * 0.52;
      this.lady.updateAnimation(deltaSeconds, false);
      const reactionComplete = this.investigationSource === "noise"
        ? this.stateTimer >= this.noiseReactionDuration
        : this.stateTimer >= this.config.suspicionDuration;
      if (reactionComplete) {
        if (visibility.visible && !visibility.suspicious && this.investigationSource === "cat") {
          this.transition(OLD_LADY_STATES.NORMAL);
        } else if (this.investigationSource === "noise") {
          this.transition(OLD_LADY_STATES.SEARCHING);
        } else if (!visibility.visible && this.investigationSource !== "noise") {
          this.transition(OLD_LADY_STATES.SEARCHING);
        }
      }
    } else if (this.state === OLD_LADY_STATES.SEARCHING) {
      this.updateSearching(deltaSeconds);
    } else if (this.state === OLD_LADY_STATES.CHASING) {
      if (visibility.visible) {
        this.targetLocation = { x: cat.x, y: cat.y };
        this.investigationSource = "cat";
        this.moveTo(this.targetLocation, deltaSeconds, this.config.chaseSpeed, this.config.arrivalRadius);
      } else {
        this.chaseTimer -= deltaSeconds;
        const reachedLastKnownPosition = this.moveTo(
          this.targetLocation,
          deltaSeconds,
          this.config.chaseSpeed,
          this.config.searchArrivalRadius,
        );
        if (reachedLastKnownPosition || this.chaseTimer <= 0) {
          this.detectionProgress = 0;
          this.transition(OLD_LADY_STATES.SEARCHING);
        }
      }
    }
  }

  getStatus() {
    return {
      state: this.state,
      suspicion: this.suspicion,
      detectionProgress: this.detectionProgress,
      targetLocation: this.targetLocation ? { ...this.targetLocation } : null,
      investigationSource: this.investigationSource,
      patrolPoint: this.patrolRoute[this.patrolIndex]?.id ?? null,
    };
  }
}
