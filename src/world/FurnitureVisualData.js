// Visual-only material hints for furniture damage and impact particles.
// Gameplay balance and object placement remain in FurnitureData and HouseData.
export const FURNITURE_VISUALS = Object.freeze({
  sofa: { material: "fabric", accent: "#d9aa75" },
  armchair: { material: "fabric", accent: "#e0b988" },
  "coffee-table": { material: "wood", accent: "#d8a05e" },
  "tv-cabinet": { material: "wood", accent: "#a88a70" },
  "living-rug": { material: "rug", accent: "#e0b47a" },
  "kitchen-counter": { material: "stone", accent: "#c9d0b7" },
  "kitchen-table": { material: "wood", accent: "#d8a05e" },
  "kitchen-cabinet": { material: "painted-wood", accent: "#d1b982" },
  "pantry-shelves": { material: "wood", accent: "#d8a05e" },
  "pantry-crates": { material: "woven", accent: "#ddb26e" },
  "study-desk": { material: "wood", accent: "#d8a05e" },
  bookcase: { material: "wood", accent: "#d8a05e" },
  bed: { material: "fabric", accent: "#c6b4d6" },
  wardrobe: { material: "wood", accent: "#d8a05e" },
  bath: { material: "ceramic", accent: "#dce8df" },
  "bathroom-vanity": { material: "painted-wood", accent: "#dce8df" },
  "storage-boxes": { material: "woven", accent: "#d4b77c" },
  "storage-cabinet": { material: "wood", accent: "#d8a05e" },
});

// Discrete visual-only levels: intact, light, medium, severe, destroyed.
// Level 3 is reached halfway through the final existing damage segment, so
// gameplay thresholds, durability and scratch timing remain unchanged.
export const FURNITURE_DAMAGE_FILTERS = Object.freeze([
  "none",
  "brightness(0.98) saturate(0.96)",
  "brightness(0.91) saturate(0.9)",
  "brightness(0.82) saturate(0.82)",
  "brightness(0.72) saturate(0.74)",
]);

export function getFurnitureVisualDamageStage(state) {
  if (!state) return 0;
  if (state.completedStages >= 3) return 4;
  if (state.completedStages >= 2) return state.stageProgress >= 0.5 ? 3 : 2;
  return state.completedStages;
}

export function getFurnitureDamageFilter(stage) {
  return FURNITURE_DAMAGE_FILTERS[Math.max(0, Math.min(4, stage))];
}

// Visible furniture extents that differ from the original gameplay rectangle.
// Values are margins from HouseData's unchanged physical footprint: negative
// values expand around drawn overhangs; positive values inset floor textures.
export const FURNITURE_VISUAL_MARGINS = Object.freeze({
  sofa: { left: -4, top: -8, right: -4, bottom: -26 },
  armchair: { left: -3, top: -6, right: -3, bottom: -12 },
  "living-rug": { left: 3, top: 4, right: 3, bottom: 4 },
  "coffee-table": { left: -8, top: -24, right: -8, bottom: -10 },
  "tv-cabinet": { left: -5, top: -6, right: -5, bottom: -12 },
});

// Optional per-object overrides for the usable E-interaction rectangle. The
// default follows the opaque visual bounds; keep this table separate from
// collision dimensions so later tuning cannot silently alter solid geometry.
export const FURNITURE_INTERACTION_BOUNDS = Object.freeze({});

// Keep object-specific prompts close to their visible footprint while leaving
// other furniture's established spacing unchanged.
export const FURNITURE_INTERACTION_PROMPT_GAPS = Object.freeze({ bookcase: 15 });

export const MATERIAL_PARTICLE_PALETTE = Object.freeze({
  wood: ["#9b6038", "#c58a4b", "#e0b36f"],
  fabric: ["#78546d", "#c98b76", "#ead0a0"],
  rug: ["#8c5544", "#c57b55", "#d9b36e"],
  stone: ["#8f9a88", "#c4c7a7", "#ddd5bc"],
  ceramic: ["#9ab5b2", "#d6e0d5", "#f0e6cf"],
  woven: ["#94734c", "#c9a66a", "#e1c58a"],
});
