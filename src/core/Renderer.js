import { HouseRenderer } from "../world/HouseRenderer.js";
import { CatRenderer } from "../entities/CatRenderer.js";
import { OldLadyRenderer } from "../entities/OldLadyRenderer.js";
import { CaptureRenderer } from "../entities/CaptureRenderer.js";
import { MouseRenderer } from "../entities/MouseRenderer.js";
import { getHouseFurnitureSpriteBounds } from "../world/FurnitureSpriteData.js";

const BACKGROUND = "#252a2d";

function isTouchInputDevice() {
  const mediaQueries = ["(pointer: coarse)", "(any-pointer: coarse)", "(hover: none)", "(any-hover: none)"];
  const coarseOrNoHover = typeof window.matchMedia === "function"
    && mediaQueries.some((query) => window.matchMedia(query).matches);
  const touchPoints = Number(navigator.maxTouchPoints ?? navigator.msMaxTouchPoints ?? 0) > 0;
  return coarseOrNoHover || touchPoints || "ontouchstart" in window;
}

function isBathScene(capturePresentation) {
  return Boolean(capturePresentation
    && capturePresentation.kind === "bathroom"
    && (capturePresentation.phase === "bath-arrival" || capturePresentation.phase === "game-over"));
}

export class Renderer {
  constructor(canvas, house) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.house = house;
    this.houseRenderer = new HouseRenderer();
    this.catRenderer = new CatRenderer();
    this.oldLadyRenderer = new OldLadyRenderer();
    this.captureRenderer = new CaptureRenderer();
    this.mouseRenderer = new MouseRenderer();
    this.catRenderer.onLoad = () => {
      if (this.lastRenderArgs) this.render(...this.lastRenderArgs);
    };
    this.mouseRenderer.onLoad = () => {
      if (this.lastRenderArgs) this.render(...this.lastRenderArgs);
    };
    this.captureRenderer.onLoad = () => {
      if (this.lastRenderArgs) this.render(...this.lastRenderArgs);
    };
    this.houseRenderer.onAssetsLoaded = () => {
      if (this.lastRenderArgs) this.render(...this.lastRenderArgs);
    };
    this.oldLadyRenderer.onLoad = () => {
      if (this.lastRenderArgs) this.render(...this.lastRenderArgs);
    };
    if (!this.context) throw new Error("This browser does not support the Canvas 2D API.");
  }

  // During the bath scenes the grandma would otherwise be drawn dead-centre
  // behind the seated cat. Pose her beside the tub instead, without touching
  // her gameplay position or the capture logic.
  getBathLadyPose(cat) {
    const bath = this.house?.furniture?.find((item) => item.id === "bath") ?? null;
    const bounds = bath ? getHouseFurnitureSpriteBounds(bath) : null;
    return {
      x: bounds ? Math.round(bounds.x + bounds.width + 48) : Math.round(cat.x) + 145,
      y: bounds ? Math.round(bounds.y + 74) : Math.round(cat.y) + 74,
      direction: "left",
    };
  }

  resize(width, height, pixelRatio) {
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  render(camera = null, cat = null, furnitureSystem = null, oldLady = null, oldLadyAI = null, capturePresentation = null, mouseSystem = null, furnitureEffects = null) {
    this.lastRenderArgs = [camera, cat, furnitureSystem, oldLady, oldLadyAI, capturePresentation, mouseSystem, furnitureEffects];
    const { canvas, context } = this;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const mouseStatus = mouseSystem?.getStatus() ?? null;
    const touchInput = isTouchInputDevice();
    const actorDrawables = [];
    if (cat && mouseSystem) {
      for (const mouse of mouseSystem.mice) {
        actorDrawables.push({
          x: mouse.x,
          y: mouse.y,
          depth: mouse.y + 27,
          draw: (worldContext) => this.mouseRenderer.draw(worldContext, mouse, mouseSystem.catchableMouse === mouse),
        });
        if (mouseSystem.catchableMouse === mouse && !touchInput) {
          actorDrawables.push({
            x: mouse.x,
            y: mouse.y,
            alwaysOnTop: true,
            draw: (worldContext) => this.mouseRenderer.drawCatchPrompt(worldContext, mouse),
          });
        }
      }
      const catchEffect = mouseSystem.catchEffect;
      if (catchEffect) {
        actorDrawables.push({
          x: catchEffect.x,
          y: catchEffect.y,
          depth: catchEffect.y + 16,
          draw: (worldContext) => this.mouseRenderer.drawCatchEffect(worldContext, catchEffect),
        });
      }
    }
    if (oldLady && oldLadyAI) {
      const bathScene = isBathScene(capturePresentation);
      const ladyPose = bathScene ? this.getBathLadyPose(cat ?? oldLady) : null;
      actorDrawables.push({
        x: oldLady.x,
        y: oldLady.y,
        depth: oldLady.y + 24,
        draw: (worldContext) => this.oldLadyRenderer.draw(
          worldContext,
          oldLady,
          oldLadyAI,
          mouseStatus?.witnessMessage ?? "",
          mouseStatus?.witnessMessageAlpha ?? 0,
          capturePresentation,
          ladyPose,
        ),
      });
    }
    if (cat) {
      // The third-capture bath scene draws its own seated cat inside the tub,
      // so the standing world-space cat is skipped for those phases only.
      if (!isBathScene(capturePresentation)) {
        actorDrawables.push({
          kind: "cat",
          x: cat.x,
          y: cat.y,
          depth: cat.y + 34,
          draw: (worldContext) => this.catRenderer.draw(worldContext, cat),
        });
      }
    }
    if (cat && oldLady) {
      actorDrawables.push({
        x: oldLady.x,
        y: oldLady.y,
        alwaysOnTop: true,
        draw: (worldContext) => this.captureRenderer.draw(
          worldContext,
          oldLady,
          cat,
          capturePresentation,
          this.catRenderer,
          this.houseRenderer,
          this.house,
          furnitureSystem,
        ),
      });
    }
    context.fillStyle = BACKGROUND;
    context.fillRect(0, 0, width, height);
    this.houseRenderer.draw(
      context,
      this.house,
      width,
      height,
      camera,
      actorDrawables,
      furnitureSystem,
      oldLady && oldLadyAI ? (worldContext) => this.oldLadyRenderer.drawVision(worldContext, oldLady, oldLadyAI) : null,
      furnitureEffects,
      { touchInput, mouseCatchable: Boolean(mouseStatus?.catchable) },
    );
  }
}
