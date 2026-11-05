// Gameplay tuning is kept separate from HouseData's placement and collision geometry.
// scratchSeconds is the time needed to complete all three damage stages; values are
// 60% of the previous tuning, preserving each object's relative scratch difficulty.
export const FURNITURE_DATA = Object.freeze({
  sofa: { maxDurability: 100, scratchSeconds: 10.8, maxScore: 150, noiseLevel: 0.82 },
  armchair: { maxDurability: 75, scratchSeconds: 8.4, maxScore: 100, noiseLevel: 0.76 },
  "coffee-table": { maxDurability: 90, scratchSeconds: 9.6, maxScore: 90, noiseLevel: 0.48 },
  "tv-cabinet": { maxDurability: 80, scratchSeconds: 9, maxScore: 85, noiseLevel: 0.55 },
  "living-rug": { maxDurability: 65, scratchSeconds: 7.8, maxScore: 120, noiseLevel: 0.32 },
  "kitchen-counter": { maxDurability: 125, scratchSeconds: 13.2, maxScore: 110, noiseLevel: 0.62 },
  "kitchen-table": { maxDurability: 90, scratchSeconds: 9.6, maxScore: 100, noiseLevel: 0.5 },
  "kitchen-cabinet": { maxDurability: 85, scratchSeconds: 9.6, maxScore: 95, noiseLevel: 0.58 },
  "pantry-shelves": { maxDurability: 80, scratchSeconds: 9, maxScore: 90, noiseLevel: 0.53 },
  "pantry-crates": { maxDurability: 55, scratchSeconds: 6.6, maxScore: 65, noiseLevel: 0.68 },
  "study-desk": { maxDurability: 100, scratchSeconds: 10.8, maxScore: 105, noiseLevel: 0.52 },
  bookcase: { maxDurability: 110, scratchSeconds: 12, maxScore: 120, noiseLevel: 0.74 },
  bed: { maxDurability: 105, scratchSeconds: 11.4, maxScore: 100, noiseLevel: 0.68 },
  wardrobe: { maxDurability: 100, scratchSeconds: 10.8, maxScore: 95, noiseLevel: 0.65 },
  bath: { maxDurability: 125, scratchSeconds: 13.2, maxScore: 80, noiseLevel: 0.42 },
  "bathroom-vanity": { maxDurability: 80, scratchSeconds: 9, maxScore: 80, noiseLevel: 0.5 },
  "storage-boxes": { maxDurability: 50, scratchSeconds: 6, maxScore: 55, noiseLevel: 0.72 },
  "storage-cabinet": { maxDurability: 90, scratchSeconds: 10.2, maxScore: 85, noiseLevel: 0.58 },
});

export const DAMAGE_STAGES = Object.freeze([
  { id: "undamaged", label: "Undamaged", threshold: 0 },
  { id: "scratched", label: "Scratched", threshold: 0.35 },
  { id: "heavily-damaged", label: "Heavily damaged", threshold: 0.7 },
  { id: "destroyed", label: "Destroyed", threshold: 1 },
]);
