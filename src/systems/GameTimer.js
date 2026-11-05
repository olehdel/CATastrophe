export const RUN_DURATION_SECONDS = 5 * 60;

export function formatRunTime(seconds) {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const remainder = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export class GameTimer {
  constructor(durationSeconds = RUN_DURATION_SECONDS) {
    this.durationSeconds = durationSeconds;
    this.reset();
  }

  reset() {
    this.remainingSeconds = this.durationSeconds;
    this.started = false;
    this.running = false;
  }

  // reset:false is used when the tutorial finishes so any time awarded before
  // the countdown began is preserved. The timer still does not run until this
  // explicit start call.
  start({ reset = true } = {}) {
    if (reset) this.reset();
    this.started = true;
    this.running = this.remainingSeconds > 0;
  }

  pause() {
    this.running = false;
  }

  resume() {
    if (this.started && this.remainingSeconds > 0) this.running = true;
  }

  addTime(seconds) {
    const bonus = Math.max(0, Number(seconds) || 0);
    if (bonus <= 0) return 0;
    this.remainingSeconds += bonus;
    return bonus;
  }

  advance(deltaSeconds) {
    if (!this.running || deltaSeconds <= 0) return 0;
    const elapsed = Math.min(deltaSeconds, this.remainingSeconds);
    this.remainingSeconds = Math.max(0, this.remainingSeconds - elapsed);
    if (this.remainingSeconds === 0) this.running = false;
    return elapsed;
  }

  get expired() {
    return this.started && this.remainingSeconds <= 0;
  }

  get formatted() {
    return formatRunTime(this.remainingSeconds);
  }
}
