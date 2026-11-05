// Source rectangles were measured from the transparent pixel-art atlas.
// Render sizes are visual only; HouseData remains the authority for world
// positions, collision footprints, scoring, and interaction.
export const HOUSE_FURNITURE_SPRITES = Object.freeze({
  "kitchen-counter": {
    source: "counter",
    rect: { x: 41, y: 62, width: 399, height: 233 },
    render: { width: 320, height: 92 },
  },
  "kitchen-table": {
    source: "atlas",
    rect: { x: 1068, y: 75, width: 354, height: 231 },
    render: { width: 170, height: 111 },
  },
  "kitchen-cabinet": {
    source: "atlas",
    rect: { x: 1136, y: 593, width: 246, height: 234 },
    render: { width: 91, height: 87, x: -8 },
  },
  "pantry-shelves": {
    source: "atlas",
    rect: { x: 787, y: 852, width: 239, height: 223 },
    render: { width: 133, height: 124, y: 44 },
  },
  "pantry-crates": {
    source: "atlas",
    rect: { x: 1140, y: 866, width: 260, height: 207 },
    render: { width: 120, height: 96 },
  },
  "study-desk": {
    source: "atlas",
    rect: { x: 68, y: 850, width: 341, height: 225 },
    render: { width: 182, height: 120 },
  },
  bookcase: {
    source: "atlas",
    rect: { x: 509, y: 836, width: 190, height: 241 },
    render: { width: 162, height: 205 },
  },
  bed: {
    source: "atlas",
    rect: { x: 66, y: 309, width: 349, height: 278 },
    render: { width: 245, height: 195 },
  },
  wardrobe: {
    source: "atlas",
    rect: { x: 797, y: 301, width: 196, height: 279 },
    render: { width: 98, height: 140 },
  },
  bath: {
    source: "atlas",
    rect: { x: 55, y: 597, width: 358, height: 228 },
    render: { width: 190, height: 121 },
  },
  "bathroom-vanity": {
    source: "atlas",
    rect: { x: 492, y: 572, width: 228, height: 257 },
    render: { width: 104, height: 117 },
  },
  "storage-boxes": {
    source: "atlas",
    rect: { x: 1140, y: 866, width: 260, height: 207 },
    render: { width: 120, height: 96 },
  },
  "storage-cabinet": {
    source: "atlas",
    rect: { x: 1117, y: 381, width: 274, height: 199 },
    render: { width: 110, height: 80 },
  },
});

export function getHouseFurnitureSpriteBounds(item) {
  const sprite = HOUSE_FURNITURE_SPRITES[item.id];
  if (!sprite) return null;
  const { width, height, x = 0, y = 0 } = sprite.render;
  return {
    x: Math.round(item.x + (item.width - width) / 2 + x),
    y: Math.round(item.y + item.height - height + y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
