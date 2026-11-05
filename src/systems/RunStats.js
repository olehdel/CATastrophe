// Single source of truth for the end-of-run ranking. Rank depends only on how
// many furniture objects were completely destroyed; score, lives and partial
// damage never influence the result.
export const RANK_THRESHOLDS = Object.freeze([
  Object.freeze({ name: "Gold", minimum: 16 }),
  Object.freeze({ name: "Silver", minimum: 13 }),
  Object.freeze({ name: "Bronze", minimum: 7 }),
]);
export const NO_RANK_LABEL = "Lost";

export function getRank(destroyedFurnitureCount) {
  const destroyed = Math.max(0, Math.floor(Number(destroyedFurnitureCount) || 0));
  const tier = RANK_THRESHOLDS.find((entry) => destroyed >= entry.minimum);
  return tier?.name ?? NO_RANK_LABEL;
}

export class RunStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.miceCaught = 0;
    this.destroyedFurnitureIds = new Set();
    this.elapsedGameplaySeconds = 0;
  }

  recordMouseCaught() {
    this.miceCaught += 1;
  }

  // A furniture object joins this set only after every damage stage is
  // complete. The Set guarantees each object contributes exactly once even if
  // the same state is synced for many frames.
  syncFurniture(furnitureStates) {
    for (const state of furnitureStates.values()) {
      if (state.completedStages >= 3) this.destroyedFurnitureIds.add(state.id);
    }
  }

  get destroyedFurnitureCount() {
    return this.destroyedFurnitureIds.size;
  }

  advanceGameplayTime(deltaSeconds) {
    this.elapsedGameplaySeconds += Math.max(0, deltaSeconds);
  }

  snapshot({ score, lives, reason, totalFurniture }) {
    const furnitureDestroyed = this.destroyedFurnitureIds.size;
    return Object.freeze({
      score,
      lives,
      rank: getRank(furnitureDestroyed),
      reason,
      miceCaught: this.miceCaught,
      furnitureDestroyed,
      totalFurniture: Math.max(0, Math.floor(Number(totalFurniture) || 0)),
      elapsedGameplaySeconds: this.elapsedGameplaySeconds,
    });
  }
}
