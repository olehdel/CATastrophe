import { formatRunTime } from "../systems/GameTimer.js";

// Compact, distinct abbreviations keep all eight rooms recognizable without
// relying on large numbered circles.
const ROOM_CODES = Object.freeze({
  "living-room": "LIV",
  kitchen: "KIT",
  pantry: "PAN",
  study: "STU",
  hallway: "HAL",
  bedroom: "BED",
  bathroom: "BTH",
  storage: "STO",
});

export class MovementHUD {
  constructor() {
    this.panel = document.querySelector("#movement-test-panel");
    this.visible = false;
    this.suppressed = false;
    this.modeOutput = document.querySelector("#movement-mode");
    this.energyMeter = document.querySelector("#energy-meter");
    this.energyOutput = document.querySelector("#energy-value");
    this.coordinateOutput = document.querySelector("#cat-coordinates");
    this.scoreOutput = document.querySelector("#score-value");
    this.targetOutput = document.querySelector("#interaction-target");
    this.progressMeter = document.querySelector("#scratch-progress");
    this.progressOutput = document.querySelector("#scratch-progress-value");
    this.scoreNotice = document.querySelector("#score-notice");
    this.oldLadyState = document.querySelector("#old-lady-state");
    this.detectionRow = document.querySelector("#detection-row");
    this.detectionMeter = document.querySelector("#detection-meter");
    this.detectionValue = document.querySelector("#detection-value");
    this.livesOutput = document.querySelector("#lives-value");
    this.captureMessage = document.querySelector("#capture-message");
    this.mouseTargetRow = document.querySelector("#mouse-target-row");
    this.mouseReward = document.querySelector("#mouse-reward");
    this.grandmaReaction = document.querySelector("#grandma-reaction");
    this.timerOutput = document.querySelector("#game-timer-value");
    this.timerDisplay = document.querySelector("#game-timer");
    this.roomProgress = document.querySelector("#room-progress");
    this.roomCompletion = document.querySelector("#room-completion");
    this.roomChips = [];
    this.furnitureCount = document.querySelector("#furniture-count");
    this.lifeDisplay = document.querySelector("#life-display");
    this.lifeLostOverlay = document.querySelector("#life-lost-overlay");
    this.lifeLostTitle = document.querySelector("#life-lost-title");
    this.lifeLostSubtitle = document.querySelector("#life-lost-subtitle");
    this.lifeLostLives = document.querySelector("#life-lost-lives");
    this.lifeLostCount = document.querySelector("#life-lost-count");
    this.setVisible(false);
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.panel.hidden = this.suppressed || !this.visible;
  }

  setSuppressed(suppressed) {
    this.suppressed = Boolean(suppressed);
    this.panel.hidden = this.suppressed || !this.visible;
  }

  toggleVisibility() {
    this.setVisible(!this.visible);
    return this.visible;
  }

  updateOldLady(status) {
    this.oldLadyState.textContent = status.state;
    const progress = Math.round(status.detectionProgress * 100);
    const showDetection = progress > 0 || status.state === "CHASING";
    this.detectionRow.hidden = !showDetection;
    this.detectionMeter.hidden = !showDetection;
    this.detectionMeter.value = progress;
    this.detectionValue.textContent = `${progress}%`;
  }

  updateMice(status) {
    this.mouseTargetRow.hidden = !status.catchable;
    this.mouseReward.textContent = status.reward
      ? `+${status.reward.score}  ·  +${status.reward.energy} energy`
      : "";
    this.grandmaReaction.textContent = status.witnessMessage;
  }

  updateTimer(remainingSeconds) {
    if (!this.timerOutput || !this.timerDisplay) return;
    this.timerOutput.textContent = formatRunTime(remainingSeconds);
    const urgent = remainingSeconds > 0 && remainingSeconds <= 60;
    this.timerDisplay.classList.toggle("game-timer--urgent", urgent);
    this.timerDisplay.setAttribute(
      "aria-label",
      urgent ? `Time remaining: ${formatRunTime(remainingSeconds)}, running low` : `Time remaining: ${formatRunTime(remainingSeconds)}`,
    );
  }

  updateFurniture(destroyed, total) {
    if (!this.furnitureCount) return;
    const safeDestroyed = Math.max(0, Math.floor(Number(destroyed) || 0));
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    const label = `${safeDestroyed} of ${safeTotal} furniture destroyed`;
    this.furnitureCount.textContent = `${safeDestroyed}/${safeTotal}`;
    this.furnitureCount.setAttribute("aria-label", label);
  }

  updateLives(lives) {
    if (!this.lifeDisplay) return;
    const remaining = Math.max(0, Math.min(3, Math.floor(lives)));
    this.lifeDisplay.setAttribute("aria-label", `${remaining} of 3 lives remaining`);
    this.lifeDisplay.querySelectorAll(".life-heart").forEach((icon, index) => {
      icon.classList.toggle("life-heart--lost", index >= remaining);
    });
  }

  buildRoomProgress(entries) {
    if (!this.roomProgress) return;
    this.roomProgress.replaceChildren();
    this.roomChips = entries.map((entry) => {
      const chip = document.createElement("div");
      chip.className = "room-chip";
      chip.dataset.roomId = entry.id;
      chip.setAttribute("role", "listitem");

      const code = document.createElement("span");
      code.className = "room-chip__code";
      code.textContent = ROOM_CODES[entry.id] ?? entry.name.slice(0, 3).toUpperCase();

      const bar = document.createElement("span");
      bar.className = "room-chip__bar";
      bar.setAttribute("aria-hidden", "true");

      const fill = document.createElement("span");
      fill.className = "room-chip__fill";
      bar.append(fill);
      chip.append(code, bar);
      chip.addEventListener("animationend", () => chip.classList.remove("room-chip--just-complete"));

      this.roomProgress.append(chip);
      return chip;
    });
  }

  updateRoomProgress(entries) {
    if (!this.roomProgress || !Array.isArray(entries)) return;
    if (this.roomChips.length !== entries.length) this.buildRoomProgress(entries);

    let completedRooms = 0;
    let destructibleRooms = 0;
    entries.forEach((entry, index) => {
      const chip = this.roomChips[index];
      if (!chip) return;
      if (entry.destructible) {
        destructibleRooms += 1;
        if (entry.complete) completedRooms += 1;
      }
      const state = !entry.destructible
        ? "neutral"
        : entry.complete
          ? "complete"
          : entry.destroyedFurniture > 0
            ? "partial"
            : "empty";
      const progress = entry.destructible ? Math.max(0, Math.min(1, entry.progress)) : 0;
      const key = `${state}:${entry.destroyedFurniture}:${entry.totalFurniture}`;
      if (chip.dataset.progressKey === key) return;

      const previousState = chip.dataset.state;
      chip.dataset.progressKey = key;
      chip.dataset.state = state;
      chip.style.setProperty("--room-progress", progress.toFixed(4));
      chip.classList.toggle("room-chip--complete", state === "complete");
      chip.classList.toggle("room-chip--neutral", state === "neutral");

      if (state === "complete" && previousState && previousState !== "complete") {
        chip.classList.remove("room-chip--just-complete");
        void chip.offsetWidth;
        chip.classList.add("room-chip--just-complete");
      }

      const label = entry.destructible
        ? `${entry.name}: ${entry.destroyedFurniture} of ${entry.totalFurniture} furniture destroyed${entry.complete ? ", room complete" : ""}`
        : `${entry.name}: no destructible furniture`;
      chip.title = label;
      chip.setAttribute("aria-label", label);
    });

    if (this.roomCompletion) {
      this.roomCompletion.textContent = `${completedRooms}/${destructibleRooms}`;
      this.roomCompletion.setAttribute(
        "aria-label",
        `${completedRooms} of ${destructibleRooms} destructible rooms complete`,
      );
    }
  }

  updateCapturePresentation(presentation, lives = 0) {
    if (!this.lifeLostOverlay) return;
    if (presentation?.phase !== "life-lost-notification") {
      this.lifeLostOverlay.hidden = true;
      this.lifeLostOverlay.style.opacity = "0";
      return;
    }

    const isBroom = presentation.kind === "broom";
    const title = isBroom ? "OUCH! Grandma caught you!" : "CAUGHT AGAIN!";
    const subtitle = isBroom ? "You lost a life." : "You lost another life.";
    if (this.lifeLostOverlay.hidden || this.lifeLostTitle.textContent !== title) {
      this.lifeLostTitle.textContent = title;
      this.lifeLostSubtitle.textContent = subtitle;
    }

    const elapsed = Math.max(0, presentation.elapsed ?? 0);
    const duration = Math.max(0.01, presentation.duration ?? 1.8);
    const alpha = Math.min(1, elapsed / 0.2, (duration - elapsed) / 0.22);
    this.lifeLostOverlay.style.opacity = String(Math.max(0, Math.min(1, alpha)));
    this.lifeLostOverlay.hidden = elapsed >= duration;

    const remaining = Math.max(0, Math.min(3, Math.floor(lives)));
    this.lifeLostLives.setAttribute("aria-label", `${remaining} ${remaining === 1 ? "life" : "lives"} remaining`);
    this.lifeLostCount.textContent = String(remaining);
    this.lifeLostLives.querySelectorAll(".life-lost-heart").forEach((icon, index) => {
      icon.classList.toggle("life-heart--lost", index >= remaining);
    });
  }

  update(status, score = 0, target = null, targetProgress = 0, scratching = false, scoreAward = 0, lives = 3, captureMessage = "") {
    this.modeOutput.textContent = status.mode.toUpperCase();
    this.energyMeter.max = status.maxEnergy;
    this.energyMeter.value = status.energy;
    this.energyOutput.textContent = `${Math.round(status.energy)}%`;
    this.coordinateOutput.textContent = `${Math.round(status.x)}, ${Math.round(status.y)}`;
    this.scoreOutput.textContent = String(score);
    this.livesOutput.textContent = "♥".repeat(Math.max(0, lives)) + ` ${lives}/3`;
    this.captureMessage.textContent = captureMessage;
    if (target) {
      this.targetOutput.textContent = `${scratching ? "Scratching" : "Nearby"}: ${target.item.label}`;
      this.progressMeter.value = targetProgress * 100;
      this.progressOutput.textContent = `${Math.round(targetProgress * 100)}% to next stage`;
    } else {
      this.targetOutput.textContent = "No furniture in reach";
      this.progressMeter.value = 0;
      this.progressOutput.textContent = "Hold E near furniture";
    }
    if (scoreAward > 0) {
      this.scoreNotice.textContent = `+${scoreAward}`;
      this.scoreNotice.classList.remove("score-notice--active");
      void this.scoreNotice.offsetWidth;
      this.scoreNotice.classList.add("score-notice--active");
    }
  }
}
