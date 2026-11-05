export const GameState = Object.freeze({
  MAIN_MENU: "main-menu",
  PLAYING: "playing",
  PAUSED: "paused",
  VICTORY: "victory",
  GAME_OVER: "game-over",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [GameState.MAIN_MENU]: [GameState.PLAYING],
  [GameState.PLAYING]: [GameState.PAUSED, GameState.VICTORY, GameState.GAME_OVER, GameState.MAIN_MENU],
  [GameState.PAUSED]: [GameState.PLAYING, GameState.MAIN_MENU],
  [GameState.VICTORY]: [GameState.PLAYING, GameState.MAIN_MENU],
  [GameState.GAME_OVER]: [GameState.PLAYING, GameState.MAIN_MENU],
});

export class GameStateManager {
  #current = GameState.MAIN_MENU;
  #listeners = new Set();

  get current() {
    return this.#current;
  }

  transition(nextState) {
    if (nextState === this.#current) return;
    if (!ALLOWED_TRANSITIONS[this.#current]?.includes(nextState)) {
      throw new Error(`Invalid game state transition: ${this.#current} to ${nextState}`);
    }

    const previousState = this.#current;
    this.#current = nextState;
    for (const listener of this.#listeners) listener(nextState, previousState);
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
