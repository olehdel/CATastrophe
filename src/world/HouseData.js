const doorway = (offset, width, id) => ({ offset, width, id });

export const HOUSE_DATA = Object.freeze({
  width: 2400,
  height: 1800,
  wallThickness: 22,
  // Closed main entry set into the west side of the central hallway wall.
  // The continuous hallway wall remains its collision boundary.
  entranceDoor: { id: "main-entrance", roomId: "hallway", side: "west", offset: 55, width: 70 },
  rooms: [
    {
      id: "living-room", name: "Living Room", x: 100, y: 100, width: 780, height: 560,
      floor: "#b8875f", pattern: "planks",
      doors: {
        north: [doorway(220, 260, "living-bay")],
        south: [doorway(275, 150, "living-hall")],
      },
      extensions: [{ id: "living-bay", x: 320, y: 45, width: 260, height: 55, openSide: "south" }],
    },
    {
      id: "kitchen", name: "Kitchen", x: 930, y: 100, width: 480, height: 440,
      floor: "#82917a", pattern: "tiles",
      doors: {
        south: [doorway(160, 150, "kitchen-hall")],
        east: [doorway(135, 125, "kitchen-pantry")],
      },
    },
    {
      id: "pantry", name: "Pantry", x: 1510, y: 100, width: 280, height: 260,
      floor: "#ad9668", pattern: "tiles",
      doors: {
        west: [doorway(135, 125, "kitchen-pantry")],
        east: [doorway(85, 100, "pantry-study")],
      },
    },
    {
      id: "study", name: "Study", x: 1880, y: 100, width: 420, height: 520,
      floor: "#7f7770", pattern: "planks",
      doors: {
        west: [doorway(85, 100, "pantry-study")],
        south: [doorway(125, 150, "study-hall")],
        east: [doorway(160, 130, "study-east-loop")],
      },
    },
    {
      id: "hallway", name: "Hallway", x: 100, y: 750, width: 2200, height: 180,
      floor: "#b49a7d", pattern: "planks",
      doors: {
        north: [
          doorway(275, 150, "living-hall"),
          doorway(990, 150, "kitchen-hall"),
          doorway(1905, 150, "study-hall"),
        ],
        east: [doorway(90, 100, "east-loop-hall")],
        south: [
          doorway(280, 140, "hall-bedroom"),
          doorway(840, 140, "hall-bathroom"),
          doorway(1430, 140, "hall-storage"),
        ],
      },
    },
    {
      id: "bedroom", name: "Bedroom", x: 100, y: 1080, width: 650, height: 600,
      floor: "#9785a0", pattern: "planks",
      doors: {
        north: [doorway(280, 140, "hall-bedroom")],
        east: [doorway(170, 150, "bedroom-bathroom")],
      },
    },
    {
      id: "bathroom", name: "Bathroom", x: 840, y: 1080, width: 420, height: 480,
      floor: "#78a0a0", pattern: "tiles",
      doors: {
        north: [doorway(100, 140, "hall-bathroom")],
        west: [doorway(170, 150, "bedroom-bathroom")],
        east: [doorway(170, 140, "bathroom-storage")],
      },
    },
    {
      id: "storage", name: "Storage", x: 1390, y: 1080, width: 420, height: 480,
      floor: "#8b8069", pattern: "planks",
      doors: {
        north: [doorway(140, 140, "hall-storage")],
        west: [doorway(170, 140, "bathroom-storage")],
      },
    },
  ],
  corridors: [
    { id: "living-connector", x: 375, y: 660, width: 150, height: 90, floor: "#a88c70", walls: ["west", "east"] },
    { id: "kitchen-connector", x: 1090, y: 540, width: 150, height: 210, floor: "#a88c70", walls: ["west", "east"] },
    { id: "kitchen-pantry-link", x: 1410, y: 235, width: 100, height: 125, floor: "#a88c70", walls: ["north", "south"] },
    { id: "pantry-study-link", x: 1790, y: 185, width: 90, height: 100, floor: "#a88c70", walls: ["north", "south"] },
    { id: "study-connector", x: 2005, y: 620, width: 150, height: 130, floor: "#a88c70", walls: ["west", "east"] },
    {
      id: "east-loop", x: 2300, y: 260, width: 70, height: 680, floor: "#a88c70", walls: ["west", "east"],
      endWalls: ["north", "south"],
      doors: { west: [doorway(0, 130, "study-east-loop"), doorway(580, 100, "east-loop-hall")] },
    },
    { id: "bedroom-connector", x: 380, y: 930, width: 140, height: 150, floor: "#a88c70", walls: ["west", "east"] },
    { id: "bathroom-connector", x: 940, y: 930, width: 140, height: 150, floor: "#a88c70", walls: ["west", "east"] },
    { id: "storage-connector", x: 1530, y: 930, width: 140, height: 150, floor: "#a88c70", walls: ["west", "east"] },
    { id: "bedroom-bathroom-link", x: 750, y: 1250, width: 90, height: 150, floor: "#a88c70", walls: ["north", "south"] },
    { id: "bathroom-storage-link", x: 1260, y: 1250, width: 130, height: 140, floor: "#a88c70", walls: ["north", "south"] },
  ],
  furniture: [
    { id: "sofa", label: "Sofa", x: 122, y: 122, width: 230, height: 88, color: "#79534a", blocksMovement: true, blocksVision: true },
    { id: "armchair", label: "Armchair", x: 743, y: 122, width: 115, height: 110, color: "#906454", blocksMovement: true, blocksVision: true },
    { id: "coffee-table", label: "Table", x: 415, y: 335, width: 150, height: 90, color: "#71543d", blocksMovement: true, blocksVision: false },
    { id: "tv-cabinet", label: "TV Cabinet", x: 743, y: 520, width: 115, height: 55, color: "#4d4845", blocksMovement: true, blocksVision: false },
    { id: "living-rug", label: "Rug", x: 280, y: 280, width: 420, height: 200, color: "#b77a56", blocksMovement: false, blocksVision: false },
    { id: "kitchen-counter", label: "Counter", x: 950, y: 118, width: 320, height: 62, color: "#596b5c", blocksMovement: true, blocksVision: true },
    { id: "kitchen-table", label: "Table", x: 950, y: 405, width: 170, height: 105, color: "#745b45", blocksMovement: true, blocksVision: true },
    { id: "kitchen-cabinet", label: "Cabinet", x: 1313, y: 390, width: 75, height: 92, color: "#68735e", blocksMovement: true, blocksVision: true },
    { id: "pantry-shelves", label: "Shelves", x: 1530, y: 115, width: 175, height: 65, color: "#806a4a", blocksMovement: true, blocksVision: true },
    { id: "pantry-crates", label: "Crates", x: 1665, y: 275, width: 85, height: 70, color: "#927449", blocksMovement: true, blocksVision: true },
    { id: "study-desk", label: "Desk", x: 1945, y: 115, width: 230, height: 85, color: "#625447", blocksMovement: true, blocksVision: true },
    { id: "bookcase", label: "Bookcase", x: 1896, y: 355, width: 162, height: 205, color: "#685744", blocksMovement: true, blocksVision: true },
    { id: "bed", label: "Bed", x: 122, y: 1105, width: 245, height: 190, color: "#756583", blocksMovement: true, blocksVision: true },
    { id: "wardrobe", label: "Wardrobe", x: 593, y: 1573, width: 135, height: 85, color: "#675849", blocksMovement: true, blocksVision: true },
    { id: "bath", label: "Bath", x: 855, y: 1420, width: 190, height: 125, color: "#c0d2cc", blocksMovement: true, blocksVision: true },
    { id: "bathroom-vanity", label: "Vanity", x: 1150, y: 1102, width: 95, height: 75, color: "#739292", blocksMovement: true, blocksVision: true },
    { id: "storage-boxes", label: "Boxes", x: 1405, y: 1435, width: 120, height: 105, color: "#77654a", blocksMovement: true, blocksVision: true },
    { id: "storage-cabinet", label: "Cabinet", x: 1685, y: 1435, width: 110, height: 95, color: "#655948", blocksMovement: true, blocksVision: true },
  ],
});
