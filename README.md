# CATastrophe

A browser-based, top-down stealth sandbox game built with plain HTML5, CSS3, and vanilla JavaScript.

## Build the self-contained offline game

Run `Build_CATastrophe.bat` from the project folder whenever source code or assets change. It rebuilds `CATastrophe.html`, bundling the JavaScript modules, CSS, and referenced assets into one file. Double-click `CATastrophe.html` on the Desktop (or open it in Chrome) to play directly from `file://`; it does not need a server or network access. The build uses Windows PowerShell and adds no dependencies. Keep `CATastrophe.html` out of source edits: it is generated output.

## Play independently of VS Code

1. Double-click `Start_CATastrophe.bat` in the project folder.
2. It starts the local server from this project root (if it is not already running) and opens `http://127.0.0.1:5500/index.html` in Chrome.
3. The server runs in a separate hidden Windows PowerShell process, so you can close VS Code and Codex while you play.
4. When finished, double-click `Stop_CATastrophe_Server.bat`.

The launcher uses Windows PowerShell and .NET's built-in TCP listener; Python and the VS Code Live Server extension are not required. Port 5500 must be free, or already serve this project. If another application is using it, the launcher reports that without stopping the other application.

## Optional: Run with Live Server

1. Open this folder in Visual Studio Code.
2. Install the **Live Server** extension if it is not already installed.
3. Open `index.html`, then select **Go Live** from the status bar (or right-click the file and choose **Open with Live Server**).
4. Use the page served by Live Server. ES modules are used, so opening the HTML directly with `file://` may prevent the JavaScript modules from loading.

## Current milestone

Milestones 1-3 provide the responsive Canvas shell, centralized states and menu controls, a connected 2,400 x 1,800 house, collision-aware cat movement, and a following camera. Milestone 4 adds hold-to-scratch furniture interaction, staged damage, proportional scoring, and noise events. Milestone 5 adds the patrolling old lady, noise investigation, line-of-sight vision, gradual detection, searching, and chasing. Milestone 6 adds three lives and chase-only captures with punishment sequences. Milestone 7 adds wandering and fleeing mice, catch interactions, configurable score and energy rewards, and Grandma's witnessed positive reaction. Milestone 8 adds the five-minute countdown, furniture-count ranks, medal-driven victory/defeat outcomes, run statistics, and results screens.

## Movement test controls

## Audio settings

Milestone 9 adds synthesized music and sound effects using the browser's Web Audio API; no audio downloads or third-party libraries are required. The audio context is created after the first user gesture so browser autoplay restrictions are respected. Open **Settings** from the main menu or pause screen to adjust master, music, and effects volume, or mute audio. Preferences are saved in local storage when available and remain active for the current session if storage is blocked. Music follows the menu, gameplay, and pause states; gameplay events and UI actions trigger rate-limited sound effects.

Audio behavior and default levels are configured in `src/systems/AudioConfig.js`; synthesis, event subscriptions, and volume persistence are handled by `src/systems/AudioManager.js`.

- `W` / `A` / `S` / `D`: move. Diagonal movement is normalized.
- Hold `Shift`: sneak at reduced speed.
- Hold `Space` while moving: sprint and consume energy. Energy regenerates while walking or standing.
- Hold `E` near furniture: scratch it. Damage progress persists independently for each object; the current scratching rate is 1.4× faster than its configured base rate. Completed stages award their score once.
- Hold `E` near a mouse: catch it. A catchable mouse is highlighted and takes priority over furniture. Mice flee when the cat approaches; caught mice award a separate score bonus and restore energy. Grandma says “Good kitty!” only when she can see the catch.
- `Esc` or the Pause button: pause. Resume continues the current run.
- Each run lasts five minutes once the tutorial is finished. Medals depend only on fully destroyed furniture: Lost 0–6, Bronze 7–12, Silver 13–15, Gold 16–18. When time runs out, any medal is a VICTORY and Lost is a DEFEAT. Being caught a third time is GAME OVER even if a medal was earned, and destroying all 18 objects is an immediate VICTORY. Catching a mouse adds 30 seconds. The compact timer turns urgent under one minute; F3 still toggles the detailed Run Stats panel. The top HUD shows all eight rooms (grey untouched, orange partial, green complete; the furniture-free hallway stays neutral), the furniture count, the timer, and remaining hearts. On phones the same HUD switches to two rows. Destroyed furniture shows a floating score popup.
- Three heart icons in the top HUD show remaining lives; lost lives turn grey. The count remains visible while paused and on either results screen.
- Lives are lost only when the chasing old lady reaches the cat. Captures one and two respawn the cat in the hallway; the third ends with the bathroom sequence. Restart resets lives and score.

The old lady's patrol route is in `src/world/OldLadyPatrolData.js`. Vision, hearing, movement, detection, state durations, and the optional vision-cone debug overlay are configured in `src/systems/OldLadyConfig.js`.

The old lady currently patrols at 200 world units/second and chases at 245. Furniture destruction emits a distinct urgent event; Grandma investigates even when ordinary sound attenuation would have filtered it out, using collision-aware paths to the nearest reachable point. Destruction investigations search for longer than ordinary sound investigations. Sound and suspicious-action sensitivity are tuned in `src/systems/OldLadyConfig.js`; sneaking and alternate routes remain viable ways to avoid visual detection. Her directional sprite atlas is a 12-column by 4-row sheet at `assets/characters/old-lady-spritesheet.png`; each row is a facing direction and each four-column group is idle, walking, or running.

Mouse population, movement, catch range, rewards, and respawn timing are configured in `src/systems/MouseConfig.js`. Predefined safe spawn locations are in `src/world/MouseSpawnData.js`.

Capture distance, punishment timing, respawn grace, and escort destination are configurable in `src/systems/CaptureConfig.js`.

## Project structure

- `index.html`: game shell, Canvas, menu, state screens, and controls.
- `style.css`: responsive visual design and interface styling.
- `game.js`: application entry point that wires the modules together.
- `src/core/Game.js`: animation frame loop, delta time, responsive canvas sizing, and renderer coordination.
- `src/core/Camera.js`: smoothly follows the cat and clamps the view to the world.
- `src/core/Input.js`: tracks keyboard controls and clears stale input on pause or focus loss.
- `src/core/GameState.js`: centralized state constants, transition rules, and notifications.
- `src/core/Renderer.js`: Canvas sizing and world-renderer coordination.
- `src/core/Collision.js`: circle/rectangle movement collision and line-of-sight intersection helpers.
- `src/systems/FurnitureSystem.js`: closest unobstructed target selection, continuous damage, stages, scoring updates, and scratch/destruction noise.
- `src/systems/Scoring.js`: run score accumulator.
- `src/systems/GameTimer.js`: five-minute delta-time countdown, mouse time bonuses, and time formatting.
- `src/systems/RunStats.js`: per-run mouse, destroyed-furniture, and active-gameplay duration statistics, plus furniture-count rank selection.
- `src/systems/AudioConfig.js`: audio defaults, music patterns, scheduler timing, and sound-effect cooldowns.
- `src/systems/AudioManager.js`: Web Audio graph, procedural music and effects, game/noise event integration, and saved preferences.
- `src/systems/MouseSystem.js`: mouse spawning, wandering/fleeing, catch selection, rewards, and catch notifications.
- `src/systems/MouseConfig.js`: configurable mouse population and behavior values.
- `src/systems/CaptureSystem.js`: capture gating, lives, punishment timing, collision-safe navigation, respawns, and grace period.
- `src/systems/CaptureConfig.js`: capture distance and sequence balance values.
- `src/systems/NoiseEvents.js`: subscribable noise event interface for future AI use.
- `src/systems/OldLadyAI.js`: rule-based state machine for patrol, suspicion, investigation, detection, and chase.
- `src/systems/NavigationGrid.js`: collision-aware A* navigation over the existing house geometry.
- `src/systems/OldLadyConfig.js`: tunable vision, hearing, movement, timing, and debug settings.
- `src/world/FurnitureData.js`: per-object durability, scratch duration, maximum score, and noise tuning.
- `src/entities/Cat.js`: player movement modes, energy, facing, and animation state.
- `src/entities/Mouse.js`: mouse movement and state data.
- `src/entities/MouseRenderer.js`: crisp Canvas mouse sprites, catch indicator, and reward effect.
- `src/entities/CatRenderer.js`: directional cat sprite processing, frame selection, crisp pixel rendering, shadows, scratching feedback, and visual reactions.
- `assets/characters/cat-spritesheet-v2.png`: current cat atlas. The measured layout has 14 front, 12 right-facing, 12 left-facing, and 14 rear-facing poses; the renderer crops each pose independently and removes only low-alpha red fringe pixels.
- `src/entities/CaptureRenderer.js`: temporary Canvas broom, sprayer, cat reaction, and bathtub effects.
- `src/entities/OldLady.js`: old lady position, facing, and movement animation state.
- `src/entities/OldLadyRenderer.js`: crisp directional sprite-sheet animation and state indicator rendering.
- `assets/characters/old-lady-spritesheet.png`: 12-column, 4-direction atlas with idle, walk, and chase cycles.
- `src/world/HouseData.js`: data definitions for rooms, corridors, doors, and furniture placement.
- `src/world/OldLadyPatrolData.js`: configurable patrol points across the house.
- `src/world/MouseSpawnData.js`: accessible mouse spawn locations distributed through the house.
- `src/world/House.js`: generated wall boundaries and world collision/occlusion queries.
- `src/world/HouseRenderer.js`: top-down house and placeholder-shape rendering, with a fit view and optional camera transform.
- `src/ui/MovementHUD.js`: unified top HUD with room status, furniture count, countdown timer, and heart lives, plus the optional detailed run panel.
- `src/ui/GameUI.js`: screen visibility, result summaries, and menu control wiring.

## Run locally in VS Code

Open this project folder (`Cat_HTML_game`) in VS Code, then use **Go Live** in the status bar or run **Live Server: Open with Live Server** from the Command Palette. The workspace settings serve this folder at `127.0.0.1:5500`.

Open the game at **http://127.0.0.1:5500/index.html**. Do not open `index.html` directly from the filesystem (`file://`), because browser module imports require an HTTP origin.
