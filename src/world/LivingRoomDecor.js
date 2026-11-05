// Decorative art bounds are independent from the collision footprints. Wall
// pieces live on the back-wall layer; floor pieces are depth-sorted with actors.
export const LIVING_ROOM_DECOR = Object.freeze([
  {
    id: "living-upper-plant", sprite: "plant", layer: "floor",
    x: 650, y: 112, width: 82, height: 104, rotation: 0,
    collisions: [{ x: 675, y: 193, width: 34, height: 19 }],
  },
  {
    id: "living-plant", sprite: "plant", layer: "floor",
    x: 805, y: 582, width: 57, height: 66, rotation: 0,
    collisions: [{ x: 823, y: 613, width: 22, height: 22 }],
  },
  { id: "living-yarn", sprite: "yarn", layer: "floor", x: 180, y: 640, width: 15, height: 14, rotation: 0, collisions: [] },
]);

export const LIVING_ROOM_DECOR_COLLISIONS = Object.freeze(LIVING_ROOM_DECOR.flatMap((decor) =>
  decor.collisions.map((rect, index) => ({
    id: `${decor.id}-collision-${index + 1}`,
    ...rect,
    blocksMovement: true,
    blocksVision: Boolean(decor.blocksVision),
    decorative: true,
  })),
));
