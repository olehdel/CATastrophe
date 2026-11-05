// Static, non-interactive garden dressing in world coordinates. The layout is
// kept outside of HouseData so it cannot affect rooms, collision or navigation.
export const EXTERIOR_GARDEN_SPRITES = Object.freeze({
  leafyTree: { x: 18, y: 37, width: 363, height: 359 },
  blossomTree: { x: 421, y: 65, width: 300, height: 311 },
  floweringShrub: { x: 778, y: 124, width: 275, height: 262 },
  flowerbed: { x: 1125, y: 189, width: 298, height: 182 },
  bench: { x: 62, y: 536, width: 272, height: 163 },
  gardenLamp: { x: 498, y: 460, width: 124, height: 249 },
  birdbath: { x: 832, y: 495, width: 184, height: 212 },
  fountain: { x: 1166, y: 481, width: 241, height: 228 },
  shed: { x: 29, y: 744, width: 362, height: 291 },
  planter: { x: 442, y: 805, width: 274, height: 179 },
  fence: { x: 777, y: 829, width: 337, height: 146 },
  stoneCluster: { x: 1181, y: 799, width: 227, height: 191 },
});

// Each decoration is centered on x/y and scaled uniformly from its measured
// opaque sprite bounds. The garden renderer skips any bounds touching a floor
// or wall, so artwork cannot cover playable interior surfaces.
export const EXTERIOR_GARDEN_DECOR = Object.freeze([
  { id: "north-oak", sprite: "leafyTree", x: 155, y: 48, scale: 0.22 },
  { id: "north-blossoms", sprite: "blossomTree", x: 690, y: 46, scale: 0.20 },
  { id: "north-shrub-west", sprite: "floweringShrub", x: 955, y: 48, scale: 0.22 },
  { id: "north-bed-kitchen", sprite: "flowerbed", x: 1220, y: 48, scale: 0.32 },
  { id: "north-lantern", sprite: "gardenLamp", x: 1455, y: 46, scale: 0.18 },
  { id: "north-bench", sprite: "bench", x: 1660, y: 48, scale: 0.28 },
  { id: "north-shrub-east", sprite: "floweringShrub", x: 1835, y: 49, scale: 0.19 },
  { id: "north-shed", sprite: "shed", x: 2145, y: 48, scale: 0.22 },
  { id: "north-flowerbed", sprite: "flowerbed", x: 2300, y: 47, scale: 0.25 },
  { id: "north-fence-one", sprite: "fence", x: 420, y: 38, scale: 0.32 },
  { id: "north-fence-two", sprite: "fence", x: 1120, y: 38, scale: 0.32 },
  { id: "north-fence-three", sprite: "fence", x: 1765, y: 38, scale: 0.32 },

  { id: "west-courtyard-tree", sprite: "leafyTree", x: 180, y: 710, scale: 0.17 },
  { id: "west-courtyard-flowerbed", sprite: "flowerbed", x: 290, y: 710, scale: 0.23 },
  { id: "center-courtyard-shrub", sprite: "floweringShrub", x: 620, y: 710, scale: 0.18 },
  { id: "center-courtyard-stones", sprite: "stoneCluster", x: 850, y: 710, scale: 0.21 },
  { id: "east-courtyard-bed", sprite: "flowerbed", x: 1440, y: 710, scale: 0.25 },
  { id: "east-courtyard-bench", sprite: "bench", x: 1740, y: 711, scale: 0.30 },
  { id: "study-courtyard-shrub", sprite: "floweringShrub", x: 2220, y: 708, scale: 0.17 },

  { id: "southwest-tree", sprite: "leafyTree", x: 175, y: 1004, scale: 0.17 },
  { id: "southwest-flowerbed", sprite: "flowerbed", x: 295, y: 1005, scale: 0.23 },
  { id: "southwest-bench", sprite: "bench", x: 640, y: 1002, scale: 0.28 },
  { id: "mid-courtyard-shrub", sprite: "floweringShrub", x: 830, y: 1004, scale: 0.17 },
  { id: "bath-courtyard-birdbath", sprite: "birdbath", x: 1160, y: 1004, scale: 0.29 },
  { id: "bath-courtyard-shrub", sprite: "floweringShrub", x: 1430, y: 1004, scale: 0.17 },
  { id: "storage-courtyard-bed", sprite: "flowerbed", x: 1740, y: 1004, scale: 0.22 },

  { id: "south-garden-tree", sprite: "blossomTree", x: 1880, y: 1170, scale: 0.19 },
  { id: "south-garden-fountain", sprite: "fountain", x: 2040, y: 1320, scale: 0.39 },
  { id: "south-garden-bench", sprite: "bench", x: 2220, y: 1180, scale: 0.38 },
  { id: "south-garden-shrub", sprite: "floweringShrub", x: 2350, y: 1330, scale: 0.16 },
  { id: "south-garden-shed", sprite: "shed", x: 2250, y: 1490, scale: 0.34 },
  { id: "south-garden-tree-two", sprite: "leafyTree", x: 1895, y: 1500, scale: 0.18 },
  { id: "south-garden-planter", sprite: "planter", x: 2050, y: 1640, scale: 0.35 },
  { id: "south-garden-flowerbed", sprite: "flowerbed", x: 2250, y: 1640, scale: 0.31 },

  { id: "bottom-garden-fountain", sprite: "birdbath", x: 990, y: 1620, scale: 0.30 },
  { id: "bottom-garden-planter", sprite: "planter", x: 1260, y: 1620, scale: 0.33 },
  { id: "bottom-garden-bench", sprite: "bench", x: 1570, y: 1620, scale: 0.34 },
  { id: "bottom-garden-fence", sprite: "fence", x: 2060, y: 1750, scale: 0.38 },
  { id: "bottom-garden-stones", sprite: "stoneCluster", x: 2350, y: 1735, scale: 0.25 },
]);

export const EXTERIOR_GARDEN_PATHS = Object.freeze([
  // The only exterior approach leads to the existing closed west entrance.
  { id: "main-entrance-path", points: [[-8, 840], [100, 840]], spacing: 21, width: 64 },
  { id: "south-garden-stepping-stones", points: [[1830, 1690], [1990, 1690], [2140, 1600], [2260, 1600]], spacing: 25, width: 52 },
]);
