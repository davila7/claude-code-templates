---
name: game-development
description: Use when building, fixing or tuning any video game. Invoke it before writing or changing game code (game loop, movement, physics, input, enemies, levels), in any engine (Godot, Unity, Unreal, Phaser, PixiJS, Three.js, Babylon.js, raw Canvas/WebGL) or platform (web, mobile, PC/console, VR/AR). Covers the game loop, fixed timestep, input mapping, frame budgets, AI, collision and game feel, and points to reference guides for 2D, 3D, game design, multiplayer, art and audio.
---

# Game Development

Core principles that hold in every engine, plus a map of the reference guides in `references/`. Read this file first, then open only the references the task needs.

## Workflow

1. **Find out what already exists.** Before suggesting an engine or architecture, look for project files:

   | File in the project | Engine / stack |
   |---------------------|----------------|
   | `project.godot`, `*.gd`, `*.tscn` | Godot |
   | `ProjectSettings/ProjectVersion.txt`, `Assets/`, `*.unity` | Unity |
   | `*.uproject`, `Source/`, `Config/DefaultEngine.ini` | Unreal |
   | `package.json` with `phaser`, `pixi.js`, `three`, `@babylonjs/core` | Web framework |
   | `<canvas>` + `requestAnimationFrame` with no framework | Raw Canvas/WebGL |

   Match the engine's conventions and version already in use. Never migrate engines or frameworks unless asked.
2. **Read the matching references** (table below). One platform guide plus one dimension guide covers most tasks.
3. **Get the core loop playable first.** Placeholder shapes and sounds are fine. Fun is found by playing, not by planning: polish, menus and content come after the 30-second loop feels good.
4. **Keep game logic separate from rendering and input**, so it can be tested and reasoned about without a frame running (see Core principles).
5. **Measure before optimizing.** Use the engine profiler or the browser Performance panel, find the slowest system, fix that, measure again.
6. **Verify by running it.** Launch the game (or its tests) after each change; a game that compiles can still be unplayable. For browser games, open the page and check the console for errors.

## Reference guides

Each file is self-contained. Load it with the Read tool when the task touches its topic.

| When the task involves... | Read |
|---------------------------|------|
| Browser games: framework choice, WebGPU/WebGL, asset loading, audio unlock, PWA | [references/web-games.md](references/web-games.md) |
| iOS/Android: touch input, battery, thermals, store rules | [references/mobile-games.md](references/mobile-games.md) |
| PC/console: engine choice (Unity, Godot, Unreal), Steam, controllers, certification | [references/pc-games.md](references/pc-games.md) |
| VR/AR: comfort, frame rate, interaction, world scale | [references/vr-ar.md](references/vr-ar.md) |
| 2D: sprites, tilemaps, 2D physics, cameras, platformer feel | [references/2d-games.md](references/2d-games.md) |
| 3D: rendering, shaders, lighting, LOD, 3D cameras | [references/3d-games.md](references/3d-games.md) |
| Design: core loop, GDD, difficulty, progression, rewards | [references/game-design.md](references/game-design.md) |
| Online play: architecture, netcode, lag compensation, anti-cheat | [references/multiplayer.md](references/multiplayer.md) |
| Visual style, asset pipeline, animation, naming | [references/game-art.md](references/game-art.md) |
| Sound design, music systems, mixing, spatial audio | [references/game-audio.md](references/game-audio.md) |

Examples:
- "Browser 2D platformer": `web-games.md`, then `2d-games.md`; `game-design.md` for level pacing.
- "Mobile puzzle game": `mobile-games.md`, then `game-design.md` for difficulty curves.
- "Multiplayer VR shooter": `vr-ar.md`, `3d-games.md`, `multiplayer.md`.

## Core principles

### 1. Game loop with a fixed timestep

Run simulation (physics, gameplay) at a fixed rate and render as often as the display allows, interpolating between the last two simulation states. A variable `dt` in physics makes jumps, collisions and replays depend on frame rate.

```js
const STEP = 1 / 60;          // simulation rate (seconds)
const MAX_FRAME = 0.25;       // clamp to avoid the "spiral of death" after a stall
let acc = 0, last = performance.now() / 1000;

function frame(nowMs) {
  const now = nowMs / 1000;
  acc += Math.min(now - last, MAX_FRAME);
  last = now;
  while (acc >= STEP) {
    applyInput();             // consume actions latched by input events, so a frame with zero ticks loses nothing
    update(STEP);             // deterministic: same input, same result
    acc -= STEP;
  }
  render(acc / STEP);         // alpha in [0,1): blend previous and current state
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Engines already provide this split; use theirs instead of writing a second loop: Godot `_physics_process` vs `_process`, Unity `FixedUpdate` vs `Update`, Phaser Arcade physics (`fixedStep: true` by default, rate set by `physics.arcade.fps`). Unreal's `Tick` is variable-rate; enable physics substepping in Project Settings and keep `DeltaSeconds` out of deterministic logic.

### 2. Input as actions, not keys

Map device input to named actions and read only actions in gameplay code:

```
"jump" → Space, Gamepad South, tap
"move" → WASD / arrows, left stick, virtual joystick
```

This gives rebinding, gamepad and touch support for free, and makes input recordable for replays and tests. Use the engine's system where it exists (Godot InputMap, Unity Input System actions, Unreal Enhanced Input). Buffer short inputs (about 100 ms) so a press just before landing still jumps.

### 3. Pick the simplest pattern that fits

| Pattern | Use when | Example |
|---------|----------|---------|
| State machine | A handful of exclusive states | Player: idle, run, jump, fall |
| Object pool | Frequent spawn/destroy | Bullets, particles, damage numbers |
| Events / signals | One system reacts to another | Health change updates the HUD |
| Command | Undo, replay, networking | Recorded inputs |
| Behavior tree | Modular AI built by designers | Enemy patrol, chase, attack |
| ECS / data-oriented | Thousands of similar entities | RTS units, bullet hell |

Start with plain objects and a state machine; move to ECS only when a profile shows per-entity overhead is the bottleneck.

### 4. Frame budget

| Target | Budget per frame |
|--------|------------------|
| 30 FPS | 33.3 ms |
| 60 FPS | 16.7 ms |
| 72 FPS (Quest) | 13.9 ms |
| 90 FPS (VR) | 11.1 ms |
| 120 FPS | 8.3 ms |

CPU (logic, physics, AI, draw submission) and GPU (rendering) work in parallel, so each must fit the budget on its own; the slower one sets the frame rate. Leave headroom (about 20%) for spikes and slower devices. Check which side is the bottleneck before optimizing: lowering resolution helps only if the GPU is the limit.

Optimization order, cheapest win first:
1. Better algorithm or data structure (O(n²) checks become a spatial hash)
2. Do less: culling, update off-screen entities less often, dirty flags
3. Fewer draw calls: atlases, batching, instancing
4. No allocations in the hot loop: pooling, reused buffers (avoids GC spikes)
5. LOD for meshes, effects and AI tick rate

### 5. AI by complexity

| Approach | Use when |
|----------|----------|
| FSM | Few states, predictable behaviour |
| Behavior tree | Many reusable behaviours, designer-tunable |
| Utility AI | Choosing among many options by score |
| GOAP / planning | Emergent multi-step goals (costly; rarely needed) |

Run AI at a lower rate than the frame (5-10 Hz is often enough) and spread agents across frames.

### 6. Collision

| Technique | Best for |
|-----------|----------|
| AABB / circle | Most 2D games, cheap broad checks |
| Capsule | Characters (slides along walls and steps) |
| Spatial hash / grid | Many objects of similar size |
| Quadtree / BVH | Large worlds with varied sizes |

Use simple collision shapes under detailed visuals. Fast objects need swept (continuous) collision or a raycast between positions, or they tunnel through thin walls.

### 7. Game feel

Small touches decide whether controls feel responsive: coyote time (jump allowed ~100 ms after leaving a ledge), jump buffering, variable jump height, hit-stop of a few frames on impact, short screen shake that decays, and an audio and visual response to every player action within the same frame.

## Anti-patterns

| Don't | Do |
|-------|----|
| Physics with variable `dt` | Fixed timestep, interpolate rendering |
| Read raw keys in gameplay code | Action map |
| Allocate objects every frame | Pools and reused buffers |
| Poll every system every frame | Events, dirty flags, lower tick rates |
| Optimize by guess | Profile, fix the top item, profile again |
| Build menus and content before the loop is fun | Playable prototype first |
| Trust the client in online games | Server-authoritative state (see `multiplayer.md`) |
| Switch engines mid-project to fix one problem | Solve it in the current engine |
