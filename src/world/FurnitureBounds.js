import {
  FURNITURE_INTERACTION_BOUNDS,
  FURNITURE_INTERACTION_PROMPT_GAPS,
  FURNITURE_VISUAL_MARGINS,
} from "./FurnitureVisualData.js";
import { getHouseFurnitureSpriteBounds } from "./FurnitureSpriteData.js";

// Visual extents account for sprite render size and offsets independently of
// the physical collision rectangle.
export function getFurnitureVisualBounds(item) {
  const spriteBounds = getHouseFurnitureSpriteBounds(item);
  if (spriteBounds) return spriteBounds;

  const margins = FURNITURE_VISUAL_MARGINS[item.id];
  if (!margins) return { x: item.x, y: item.y, width: item.width, height: item.height };
  return {
    x: item.x + margins.left,
    y: item.y + margins.top,
    width: item.width - margins.left - margins.right,
    height: item.height - margins.top - margins.bottom,
  };
}

// HouseData's x/y/width/height remains the authoritative physical footprint.
// Keeping a named accessor makes that role explicit at collision call sites.
export function getFurnitureCollisionBounds(item) {
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

// Interaction can be tuned independently per object. With no override, it
// matches the rendered object bounds and therefore keeps existing targeting.
export function getFurnitureInteractionBounds(item) {
  const override = FURNITURE_INTERACTION_BOUNDS[item.id];
  if (!override) return getFurnitureVisualBounds(item);
  return {
    x: item.x + override.x,
    y: item.y + override.y,
    width: override.width,
    height: override.height,
  };
}

export function getFurnitureInteractionPromptGap(item) {
  return FURNITURE_INTERACTION_PROMPT_GAPS[item.id] ?? 19;
}
