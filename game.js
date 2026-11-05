import { Game } from "./src/core/Game.js";
import { GameStateManager } from "./src/core/GameState.js";
import { GameUI } from "./src/ui/GameUI.js";
import { HOUSE_DATA } from "./src/world/HouseData.js";
import { House } from "./src/world/House.js";
import { MovementHUD } from "./src/ui/MovementHUD.js";
import { Scoring } from "./src/systems/Scoring.js";
import { NoiseEvents } from "./src/systems/NoiseEvents.js";
import { FurnitureSystem } from "./src/systems/FurnitureSystem.js";
import { OldLady } from "./src/entities/OldLady.js";
import { OldLadyAI } from "./src/systems/OldLadyAI.js";
import { OLD_LADY_PATROL_ROUTE } from "./src/world/OldLadyPatrolData.js";
import { AudioManager } from "./src/systems/AudioManager.js";

const canvas = document.querySelector("#game-canvas");
const stateManager = new GameStateManager();
const house = new House(HOUSE_DATA);
const movementHUD = new MovementHUD();
const scoring = new Scoring();
const noiseEvents = new NoiseEvents();
const audioManager = new AudioManager(noiseEvents);
audioManager.bindUserGesture();
const furnitureSystem = new FurnitureSystem(house, scoring, noiseEvents);
const oldLady = new OldLady(OLD_LADY_PATROL_ROUTE[0]);
const oldLadyAI = new OldLadyAI(oldLady, house, noiseEvents, OLD_LADY_PATROL_ROUTE);
const game = new Game(canvas, stateManager, house, movementHUD, furnitureSystem, oldLady, oldLadyAI, audioManager);

new GameUI(stateManager, game, movementHUD, audioManager);
