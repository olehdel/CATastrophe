CATastrophe
Game Design Document · Version 1.0 · November 2026
2D Top-down
Cartoon
Stealth / Sandbox

High concept

A mischievous cat must cause as much destruction as possible inside an elderly woman's house while avoiding detection, hunting mice and pretending to be a good kitty.

1. Game overview
Property	Specification
Title	CATastrophe
Genre	Stealth, sandbox, comedy, destruction
Platform	Desktop browser
Technology	HTML5, CSS3, JavaScript
Perspective	2D top-down
Art direction	Cartoon / illustrated
Difficulty	Challenging
Players	Single-player
Camera	Follows the cat
Main objective	Reach a destruction target before time expires

Game fantasy: The player is a cat. The house belongs to an old lady who loves her furniture. The cat loves destroying it.
2. Core gameplay loop
1. Explore the house and locate valuable furniture.
2. Find opportunities to scratch and destroy objects.
3. Avoid the old lady's vision and hearing.
4. Hide when she investigates suspicious activity.
5. Catch mice to restore energy and earn rewards.
6. Reach the destruction target before time expires.
7. Win with the best possible score and remaining lives.

3. Game world and environment
The initial game takes place inside one fully accessible house.







it.pngtree.com


Room	Objects and gameplay opportunities
Living room	Sofas, armchairs, carpets, curtains, television
Kitchen	Cabinets, chairs, table, food and mice
Bedroom	Bed, pillows, wardrobe, hiding places
Bathroom	Towels, toilet paper, bath mats
Hallway	Connecting rooms, furniture and patrol routes

All rooms are accessible from the beginning.

The house should have:
- Walls and collision boundaries.
- Doors and passages between rooms.
- Furniture that blocks movement.
- Designated hiding places.
- Objects that can be scratched or destroyed.
- Mouse spawn locations.
4. Player character







pinterest.com


The player controls an orange mischievous cat.
Controls
Key	Action
W	Move up
A	Move left
S	Move down
D	Move right
Shift	Sneak
Space	Sprint
E (hold)	Scratch furniture / interact / hide / catch mouse
Esc	Pause menu

Movement should be smooth, with directional animations.
Cat abilities
- Walking: Normal movement and moderate noise.
- Sneaking: Slower movement, reduced noise.
- Sprinting: Faster movement, consumes energy and produces more noise.
- Scratching: Damages nearby objects.
- Hiding: Conceals the cat in designated hiding locations.
- Hunting: Catches mice for food and rewards.
Energy
Energy is consumed only by sprinting.
- Energy decreases while sprinting.
- Energy regenerates when walking or standing still.
- Scratching does not consume energy.
- Energy is displayed on the HUD.
5. Destruction system




















6










Each destructible object has:
- Unique damage capacity.
- Destruction point value.
- Noise level.
- Scratching duration.
- Three visual damage stages.
Damage stage	Appearance
0-34%	Undamaged
35-69%	Scratched
70-99%	Heavily damaged
100%	Destroyed

Initial object values
These values are starting balance estimates.
Object	Points	Noise
Sofa	150	High
Curtains	100	Medium
Carpet	120	Low
Armchair	100	High
Wallpaper	80	Medium
Pillows	40	Low
Toilet paper	60	Low

When scratching:
- The player must hold E.
- The cat plays a scratching animation.
- A progress indicator appears.
- The object's appearance changes as damage increases.
- A floating score notification appears when damage is awarded.
- Destroying an object generates a noise event.
Objects cannot be destroyed repeatedly for unlimited points.
6. Stealth and detection system
Stealth is a core gameplay mechanic.

The old lady detects the cat through two primary systems.

Vision
- The old lady has a visible field of vision.
- Detection depends on distance and line of sight.
- Walls and certain objects block vision.
- The player should see a visual representation of the danger area.
Hearing
- Scratching creates noise.
- Sprinting creates noise.
- Destroying objects creates noise.
- Loud noises attract the old lady.
- Sneaking reduces noise.
Detection indicator
The player should receive visual feedback when the old lady starts noticing suspicious activity.

Possible indicators:
- Small question mark: Suspicion.
- Exclamation mark: Alert.
- Red indicator: Cat spotted.
7. Old lady AI







etsy.com


The old lady is controlled by an adaptive AI system.

She should react to the player's actions rather than simply walking randomly.
AI states
State	Behaviour
Normal	Follows her daily routine
Suspicious	Investigates unusual sounds
Searching	Searches the area where the cat was last seen
Chasing	Pursues the cat
Punishment	Captures and punishes the cat

Adaptive behaviour
The AI should consider:
- Previous destruction events.
- Noise locations.
- Last known cat position.
- Whether the cat has been hiding.
- Whether the cat has been repeatedly spotted.
- Time spent without detecting the cat.
She should also perform routine activities such as watching TV, reading, cooking and walking between rooms.

The AI should be challenging but fair. The player must have opportunities to escape and hide.
8. Lives and punishment system




















7










The player starts with three lives.
Capture	Punishment	Remaining lives
First	Hit with broom	2
Second	Sprayed with plant sprayer	1
Third	Given a bath - game over	0

Each punishment must have its own animation.

The capture sequence:
1. Old lady catches the cat.
2. Movement is temporarily disabled.
3. Punishment animation plays.
4. One heart is removed.
5. Cat respawns at a safe location.
6. Game resumes, unless it was the third capture.
The player should not be able to avoid a punishment once the capture sequence begins.
9. Mouse and food system









Mice appear randomly and move around the house.

Catching mice:
- Restores cat energy.
- Provides bonus points.
- Can reduce the old lady's suspicion.
- Makes the old lady praise the cat if she witnesses the catch.
The old lady should say things like:
- "Good kitty!"
- "What a clever little hunter!"
- "Who's my good cat?"
This creates an interesting gameplay contrast: the cat can be rewarded for hunting mice but punished for destroying furniture.
10. HUD and user interface







80.lv


The gameplay HUD must include:
Element	Description
Timer	Remaining game time
Destruction score	Current points / target
Hearts	Three player lives
Energy bar	Sprint energy
Noise meter	Current noise level
Minimap	House layout and character positions

Additional screens
- Main menu.
- Game instructions.
- Pause menu.
- Settings.
- Victory screen.
- Game-over screen.
Results screens
Show:
- Final destruction score.
- Time remaining.
- Lives remaining.
- Objects destroyed.
- Mice caught.
- Performance medal (Bronze, Silver, Gold or Lost), displayed separately
  from the outcome.
11. Game objective and progression
The game ends when any of these happens:
- All destructible furniture is destroyed (immediate VICTORY, highest priority).
- The timer expires (VICTORY with any medal, DEFEAT with Lost).
- The player loses all three lives (GAME OVER, regardless of medal).
Rank thresholds
Rank	Requirement
Lost	0–6 furniture destroyed
Bronze	7–12 furniture destroyed
Silver	13–15 furniture destroyed
Gold	16–18 furniture destroyed

The medal depends only on how many furniture objects were completely destroyed.
Partial damage does not count, each object counts once, and score, remaining
lives or the ending reason never influence the medal. The outcome is separate:
time expiry with a medal is a victory, time expiry with Lost is a defeat, a
third capture is game over even with a medal, and clearing all 18 is an
immediate victory.
Initial timer	5 minutes (plus 30 seconds per mouse caught)
Starting lives	3

The exact balance can be adjusted after playtesting.
12. Art direction and animations
The game should have a cohesive cartoon aesthetic.
Visual requirements
- 2D top-down perspective.
- Warm, cozy, slightly old-fashioned house.
- Expressive cartoon characters.
- Clear silhouettes.
- Readable furniture and interactive objects.
- Smooth animations.
- Visually distinguishable damage stages.
- Consistent proportions and color palette.
Required cat animations
- Idle.
- Walking in four directions.
- Sneaking.
- Sprinting.
- Scratching.
- Hiding.
- Hunting.
- Catching a mouse.
- Being punished.
- Victory and defeat.
Required old lady animations
- Idle.
- Walking.
- Cooking.
- Reading.
- Watching television.
- Suspicious reaction.
- Searching.
- Chasing.
- Broom attack.
- Spraying water.
- Bathing the cat.

13. Technical requirements
This section is particularly important for Codex.

Technology stack
Technology	Purpose
HTML5	Game page and structure
CSS3	Menus and interface
JavaScript	Gameplay logic
HTML5 Canvas	Game rendering
Web Audio API	Sound and music

I recommend using HTML5 Canvas for the game world because we need smooth movement, camera tracking, collision detection, animations and many interactive objects.
Suggested project architecture
Cat_HTML_game/
│
├── index.html
├── style.css
├── game.js
│
├── src/
│   ├── core/
│   │   ├── Game.js
│   │   ├── Input.js
│   │   ├── Camera.js
│   │   └── Collision.js
│   │
│   ├── entities/
│   │   ├── Cat.js
│   │   ├── OldLady.js
│   │   ├── Mouse.js
│   │   └── Furniture.js
│   │
│   ├── systems/
│   │   ├── Stealth.js
│   │   ├── Destruction.js
│   │   ├── Detection.js
│   │   ├── Scoring.js
│   │   └── Audio.js
│   │
│   ├── ui/
│   │   ├── HUD.js
│   │   ├── MainMenu.js
│   │   └── GameOver.js
│   │
│   └── world/
│       ├── House.js
│       ├── Room.js
│       └── FurnitureData.js
│
└── assets/
    ├── characters/
    ├── furniture/
    ├── environment/
    ├── audio/
    └── ui/


This is a proposed architecture, not a requirement to create every file immediately.
Technical rules
1. Maintain a consistent game update loop using requestAnimationFrame.
2. Separate rendering from gameplay logic.
3. Use delta time for movement and animations.
4. Implement collision detection for walls, furniture and characters.
5. Use a camera that smoothly follows the cat.
6. Ensure the game works at different browser window sizes.
7. Keep game state separate from interface state.
8. Make AI behaviour modular and maintainable.
9. Avoid unnecessary external dependencies.
10. Support restarting the game without refreshing the browser.
14. Development roadmap
We should not ask Codex to implement everything at once.
Phase	Deliverable
1	Game foundation and rendering engine
2	House layout and collision
3	Cat movement and camera
4	Furniture and destruction
5	Old lady AI and stealth
6	Lives and punishment animations
7	Mice and rewards
8	HUD and menus
9	Sound, visual effects and animations
10	Testing, balancing and optimization

Each phase must result in a working, testable version.

15. Important development principles
These are instructions that Codex should follow throughout the project.
- Do not change established gameplay mechanics without permission.
- Do not replace missing assets with unrelated visual placeholders without explaining the limitation.
- Keep all source code organized.
- Avoid putting the entire game into one JavaScript file.
- Test each new feature.
- Preserve previously working mechanics when implementing new features.
- Do not implement several major systems simultaneously.
- Ask before making major design decisions that are not specified in this document.
