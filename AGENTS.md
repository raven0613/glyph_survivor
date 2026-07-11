# Glyph Survivor — AI Engineering Guide

This file is the implementation contract for AI coding agents working in this repository.

Read `spec.md` before designing or changing gameplay. `spec.md` is the product source of truth; this file is the architecture and engineering source of truth. If the two conflict, preserve the product intent in `spec.md` and update this file explicitly instead of silently inventing a third direction.

## 1. Project status

- The repository currently contains the default Vite/React starter UI.
- The structure below is the target architecture, not a claim that every module already exists.
- Add the architecture incrementally. Do not scaffold empty layers that are not needed by the current feature.
- The previous DOCX system-design artifact is not an implementation contract. This file is.

## 2. Product invariants

These rules come directly from `spec.md` and must survive refactors:

- The game is a Survivors-like / Bullet Heaven whose world is made of text.
- Player, enemies, bosses, projectiles, explosions, particles, drops, effects, and UI should use text/ASCII as the primary visual language.
- A Glyph is an independently controllable gameplay Cell, not merely a decorative character.
- Local damage must visibly remove or weaken only the hit region of a body.
- Boss materials must differ in hit response, recovery, destruction, and death behavior.
- Weapon identity comes from target logic, attack shape, and destruction shape—not only numeric damage.
- Upgrades should change play patterns and builds, not only add small percentage bonuses.
- Opening the upgrade screen completely pauses gameplay simulation.
- Boss splitting redistributes existing Glyphs and HP. It must not increase total Glyph count or total HP layers.

## 3. Non-negotiable architecture

The dependency direction is:

```text
React UI
   ↓ commands            ↑ immutable UI snapshots
GameHost / Bridge
   ↓
Plain JavaScript Game Runtime
   ↓ render snapshots
PixiJS Render Adapter
   ↓
Canvas
```

The ownership rules are:

1. React owns menus and UI state.
2. Game Runtime owns authoritative gameplay state.
3. PixiJS owns display objects and GPU resources.
4. The bridge owns lifecycle and cross-boundary communication.
5. No layer may treat another layer's state as its own source of truth.

### MUST

- Keep React limited to UI, menus, settings, HUD, upgrade choices, pause overlays, and game-over screens.
- Implement the game loop, gameplay state, systems, and PixiJS canvas code as ordinary ESM modules under `src/game/**`.
- Use `.ts` for XState state-machine modules under `src/game/runtime/**`. Continue using `.js` elsewhere under `src/game/**` unless the user explicitly changes that rule.
- Use TypeScript types for state-machine contracts. Use JSDoc typedefs for JavaScript modules and runtime validation at important cross-boundary entry points in both languages.
- Give the Game Runtime exclusive write access to authoritative gameplay state.
- Communicate from React to the game through explicit commands.
- Communicate from the game to React through small, immutable UI snapshots or discrete events.
- Let the renderer consume render snapshots; never let it decide gameplay outcomes.
- Make creation, start, pause, reset, and disposal explicit lifecycle operations.

### MUST NOT

- Do not update React state every animation frame.
- Do not store enemies, bullets, Glyph arrays, or Pixi display objects in React state, context, reducers, or refs used as gameplay storage.
- Do not put the simulation loop in a React render path.
- Do not import React from `src/game/**`.
- Do not import PixiJS outside `src/game/rendering/**` or a narrowly scoped asset/bootstrap adapter.
- Do not import DOM APIs into gameplay core modules.
- Do not store HP, damage rules, AI state, or authoritative positions on Pixi display objects.
- Do not read a Sprite/Particle position back into gameplay state.
- Do not create one expensive `Text` or `HTMLText` object per Glyph for large enemy bodies.
- Do not introduce a large ECS framework until measured requirements justify it.

## 4. Target directory layout

Create only the directories required by the current milestone, but preserve these ownership boundaries:

```text
src/
  app/                         React-only application shell
    components/                Reusable UI components
    screens/                   Menu, Settings, Upgrade, GameOver
    hooks/                     useGameCommands, useGameUiSnapshot

  game/                        Plain ESM JavaScript; never imports React
    host/                      Lifecycle and dependency wiring
      createGameHost.js

    bridge/                    Cross-boundary contracts
      gameCommands.js
      uiSnapshot.js
      renderSnapshot.js

    runtime/                   Loop, clock, phase, scheduler
      createGameLoop.js
      gameClock.js
      gamePhase.js
      systemScheduler.js

    core/                      Engine-agnostic data structures
      entityStore.js
      eventQueue.js
      seededRng.js
      spatialHash.js
      objectPool.js

    systems/                   Gameplay behavior
      inputSystem.js
      movementSystem.js
      directorSystem.js
      targetingSystem.js
      weaponSystem.js
      projectileSystem.js
      collisionSystem.js
      damageSystem.js
      deathSystem.js
      dropSystem.js
      upgradeSystem.js
      cleanupSystem.js

    glyph/                     Text-body simulation
      glyphStore.js
      glyphLayout.js
      glyphMaterial.js
      localDamage.js

    content/                   Validated data definitions
      weapons/
      bosses/
      upgrades/

    rendering/                 The only normal PixiJS dependency boundary
      createPixiApp.js
      createSceneLayers.js
      renderSync.js
      glyphViewPool.js
      projectileViewPool.js
      effectViewPool.js

    persistence/               Settings/save adapters and migrations

  shared/                      Small side-effect-free shared contracts/constants

tests/
  unit/
  integration/
  performance/
  e2e/
```

Do not create generic `utils.js`, `helpers.js`, or catch-all `manager` modules. Name modules after one clear responsibility.

## 5. Allowed dependency graph

Use these imports as the default rule:

```text
src/app/**
  may import: game/bridge, game/host, shared
  must not import: game/systems, game/glyph internals, game/rendering internals

src/game/host/**
  may import: bridge, runtime, content, persistence, rendering

src/game/runtime/** and src/game/systems/**
  may import: core, glyph, content contracts, bridge contracts
  must not import: React, PixiJS, DOM

src/game/glyph/**
  may import: core and pure content contracts
  must not import: React, PixiJS, DOM

src/game/rendering/**
  may import: PixiJS, render snapshot contracts, rendering-only assets
  must not mutate: WorldState or domain objects
```

If a feature requires a reverse dependency, introduce a command, event, snapshot, or injected port. Do not add a convenient circular import.

## 6. React integration contract

React should mount one canvas host and one GameHost instance.

Recommended responsibilities:

```text
<App>
  <GameCanvas />       mounts/disposes GameHost
  <Hud />              reads UiSnapshot
  <UpgradeScreen />    visible only in PAUSED_UPGRADE
  <PauseMenu />
  <GameOverScreen />
```

The bridge API should remain small and explicit. A representative shape is:

```js
const gameHost = await createGameHost({ canvas, config })

gameHost.startRun({ seed })
gameHost.pause()
gameHost.resume()
gameHost.selectUpgrade({ choiceId })
gameHost.updateSettings(settings)
gameHost.restart()
gameHost.dispose()

const unsubscribe = gameHost.subscribeUi((uiSnapshot) => {})
```

Rules:

- `subscribeUi` publishes only UI-sized data: phase, HP, max HP, XP, level, timer, upgrade choices, boss summary, and recoverable errors.
- Do not include entity arrays, Glyph arrays, projectiles, particles, Pixi objects, or mutable WorldState references.
- Publish when relevant UI values change or on a low-frequency throttle. Do not publish at display refresh rate by default.
- React StrictMode may mount, clean up, and mount again. GameHost initialization and disposal must not leak a ticker, RAF, event listener, canvas, or asset subscription.
- React controls the upgrade DOM/UI. Runtime controls whether simulation is paused and whether a choice is valid.

## 7. Game phases and lifecycle

Use an explicit phase/state machine rather than scattered booleans:

```text
BOOT
  → LOADING
  → RUNNING
  ↔ PAUSED_MENU
  → PAUSED_UPGRADE
  → RUNNING
  → GAME_OVER
  → DISPOSED
```

Required behavior:

- Asset/config failure stays in `LOADING` or transitions to a documented error state; it must not start a partial simulation.
- `PAUSED_UPGRADE` stops fixed simulation steps completely.
- Menu pause stops gameplay time. Rendering may remain static or run at a deliberately reduced rate.
- Repeated `start`, `pause`, `resume`, and `dispose` calls must have defined idempotent behavior.
- Disposal removes DOM listeners, input listeners, ticker/RAF callbacks, subscriptions, scene nodes, and owned GPU resources.

For PixiJS v8:

- Construct with `new Application()` and then `await app.init(options)`.
- Do not pass v7-style options to the constructor.
- Use `app.canvas`, not deprecated `app.view`.
- Do not touch `app.canvas`, `app.renderer`, or `app.screen` before `app.init()` resolves.
- When recreating an Application in the same tab, destroy with `releaseGlobalResources: true` when the application owns those global resources.

## 8. Time and simulation model

Use `requestAnimationFrame` or Pixi's ticker only as the frame driver. Gameplay must use a fixed timestep.

Default target:

```text
fixedStepMs = 1000 / 60
```

Frame algorithm:

1. Clamp an abnormally large real-frame delta.
2. Add it to an accumulator.
3. Run zero or more fixed simulation steps.
4. Limit catch-up steps per frame to avoid a spiral of death.
5. Record dropped/capped time for diagnostics.
6. Publish a render snapshot.
7. Render with interpolation when useful.

Do not feed arbitrary render-frame delta directly into collision, damage, cooldown, spawn, or AI rules.

Each fixed step runs systems in a stable order:

```text
Input sample
→ Movement
→ Spawn / Director
→ Targeting / Weapons
→ Projectile movement / Collision
→ Damage / Glyph material response
→ Death / Boss split / Drops / XP
→ Upgrade trigger
→ Cleanup
→ Snapshot publication
```

Systems must not add/remove objects from a collection while another system is iterating it. Queue structural changes and commit them at a defined boundary.

## 9. Authoritative gameplay data

`WorldState` is the gameplay source of truth. It should contain plain data, stores, queues, IDs, and indexes—not React or Pixi objects.

Use stable IDs for entities, Glyphs, events, and commands when they cross module boundaries.

Mutation is allowed inside tightly owned, performance-critical stores. Keep it local and explicit. Outside those stores, prefer immutable snapshots and command/event payloads.

Random behavior must use an injected seeded RNG. Do not call `Math.random()` inside gameplay systems. Record the run seed and content version so failing scenarios can be reproduced.

## 10. Glyph model

A Glyph Cell needs enough data to support the spec:

```js
/**
 * @typedef {object} GlyphCell
 * @property {number} id
 * @property {number} ownerId
 * @property {number} glyphFrame
 * @property {number} localX
 * @property {number} localY
 * @property {number} hpLayer
 * @property {number} alpha
 * @property {number} rotation
 * @property {number} offsetX
 * @property {number} offsetY
 * @property {number} velocityX
 * @property {number} velocityY
 * @property {number} scale
 * @property {number} flags
 */
```

This is a conceptual contract; optimize storage after measurement. For high counts, prefer packed arrays, struct-of-arrays, or paged typed arrays over thousands of class instances.

Preserve the distinction between:

- anchor/local position: the body's intended shape;
- offset/velocity: temporary deformation, knockback, scattering, and recovery;
- HP layer: durability and brightness stage;
- render alpha/tint: visual output derived from gameplay state.

Local damage flow:

1. Weapon emits a `DamageShape` and impact parameters.
2. Spatial index returns candidate Glyphs.
3. Precise shape test filters candidates.
4. Damage changes only those Glyph HP layers.
5. Material response changes offset/velocity/recovery behavior.
6. Destroyed Glyphs leave a visible local hole.

Never implement local damage by reducing a whole Boss container's alpha.

## 11. Boss and material rules

Boss behavior should be composed from data and strategies instead of a single giant switch.

A Boss definition should separate:

- layout/body generation;
- movement/AI;
- Glyph material response;
- phase transitions;
- split behavior;
- death behavior;
- drop/reward rules.

Material examples:

- `SLIME`: high displacement, spring-like recovery, can redistribute Glyphs when splitting.
- `GOLEM`: low knockback, slow erosion, rigid recovery.
- `GHOST`: low alpha, easy dispersal, strong reassembly behavior.
- `SNAKE`: segment ownership, breakable connectivity, independent segment motion.

For every split operation, test these invariants:

```text
glyphCountBefore === glyphCountAfter
sumHpLayersBefore === sumHpLayersAfter
every original glyphId has exactly one new owner
no new combat HP is created
```

## 12. Weapon and upgrade rules

Separate weapon concerns:

```text
TargetStrategy       nearest, cone, random, chain candidate, manual aim
AttackPattern        single, burst, spread, beam, orbit, chain
DamageShape          point, circle, capsule, line, cone
DestructionProfile   knockback, pierce, explosion, split, erosion
```

Content definitions may select strategies and parameters. They must not contain hidden mutable runtime state.

Gameplay projectiles are the only projectile-like objects that participate in damage/collision. Visual particles are rendering-only and never cause damage.

Upgrade effects should produce explicit modifiers or strategy changes. Avoid scattered checks such as `if (hasUpgradeX)` across unrelated systems.

## 13. PixiJS rendering rules

Recommended scene layers:

```text
stage
  worldRoot              render group where appropriate
    backgroundLayer
    dropLayer
    enemyGlyphLayer
    projectileLayer
    effectLayer
  debugLayer
```

Rendering rules:

- Use PixiJS scene objects only inside the rendering layer.
- Use a shared glyph atlas. Prefer bitmap/MSDF glyph rendering for frequently changing or numerous text visuals.
- Do not use `Text` or `HTMLText` for per-frame-updated high-volume Glyphs.
- `Text` is acceptable for small, static, or infrequently changed labels.
- `BitmapText` is suitable for frequently changing counters or longer text whose characters do not need independent gameplay ownership.
- For high-volume independent Glyph views, use atlas frames with pooled `Particle`/`Sprite` views according to required features.
- `ParticleContainer` is appropriate only when particles share a base texture and do not require per-particle filters, masks, events, or blend modes.
- Set only actually animated `dynamicProperties` on `ParticleContainer`.
- Set `boundsArea` when using `ParticleContainer`, especially with culling.
- Group similar object types, base textures, and blend modes to preserve batching.
- Use object pools for projectiles, Glyph fragments, damage particles, and short-lived effects.
- Disable interaction (`eventMode = 'none'`) on non-interactive world subtrees.
- Use culling only after profiling; it trades CPU bounds checks for less rendering.
- Do not enable high resolution or antialiasing without target-device profiling.
- Never change `Text.text` every frame unless guarded by a real value change; prefer bitmap text for dynamic counters.

The visual representation may use an atlas texture internally. This does not violate the product rule that a Glyph is a living Cell: gameplay identity lives in `GlyphStore`, while the texture is only a batched rendering technique.

## 14. Input rules

- Keyboard and pointer input belong to an `InputAdapter`, not React state.
- Store key/button state and the latest pointer position, then sample them at the start of each fixed step.
- Convert pointer coordinates into world coordinates through the render/camera adapter.
- Input events enqueue commands or update input state; they must not mutate entities directly.
- Remove all listeners during GameHost disposal.

## 15. Performance budgets and degradation

Do not optimize blindly, but design hot paths so they can be measured.

Initial engineering targets, subject to target-device validation:

- Desktop frame p95: at or below 16.7 ms.
- Reduced-quality frame p95: at or below 33 ms.
- Simulation step p95 in ordinary combat: at or below 6 ms.
- Simulation step p95 in the agreed Boss stress case: at or below 10 ms.

Track at minimum:

- frame time and simulation time;
- active entity/Glyph/projectile/effect counts;
- pool capacity and pool misses;
- draw calls when practical;
- capped/dropped simulation steps;
- invalid numeric state (`NaN`, infinity);
- orphaned or multiply-owned Glyph IDs.

Quality degradation order should be deliberate, for example:

1. reduce purely visual particle density;
2. reduce effect update frequency;
3. reduce render resolution/antialiasing;
4. cap rendering at 30 FPS while preserving fixed simulation semantics.

Do not degrade gameplay projectile accuracy, local damage correctness, or Boss HP invariants to improve visuals.

## 16. TypeScript and JavaScript standards for `src/game/**`

- Use ESM imports/exports.
- Use descriptive function and variable names.
- Prefer small modules and pure functions for rules/calculations.
- Use factory functions when lifecycle or injected dependencies matter.
- Use classes only when identity and lifecycle genuinely benefit from them.
- Avoid module-level mutable singletons except documented Pixi/asset infrastructure.
- Validate content, save data, and cross-boundary commands at entry points.
- Handle async initialization errors explicitly.
- Name constants instead of scattering magic numbers.
- Use TypeScript types in `.ts` modules and JSDoc for exported contracts in `.js` modules and non-obvious public functions.
- Comment why a constraint exists; do not narrate obvious code.
- Keep performance mutations inside owned stores and document the ownership boundary.
- Prefer guard clauses over deeply nested control flow.

## 17. Testing contract

Gameplay logic must be testable without rendering a canvas.

Required test categories as features are added:

- Unit tests for systems, shapes, cooldowns, modifiers, Glyph materials, and split invariants.
- Integration tests using a fake clock and seeded RNG.
- Bridge contract tests for commands and UI/render snapshots.
- Lifecycle tests for initialize, pause, resume, restart, StrictMode remount, and dispose.
- Performance scenarios with fixed entity/Glyph counts.
- E2E tests for start → combat → level up → full pause → choose upgrade → resume → game over.

Use behavior-focused names, for example:

```text
damages only glyphs inside the explosion radius
preserves total glyph hp when slime splits
stops simulation steps while upgrade choices are open
does not create a second ticker after StrictMode remount
replays the same combat result with the same seed and commands
```

For deterministic soak tests, fail on:

- `NaN` or infinite numeric values;
- duplicated IDs;
- orphaned Glyphs;
- total HP increasing after split;
- unbounded pool growth;
- updates occurring during `PAUSED_UPGRADE`.

## 18. AI implementation workflow

Before changing code:

1. Read the relevant section of `spec.md`.
2. Inspect nearby code and the current repository structure.
3. Identify the owning layer and verify dependency direction.
4. State assumptions only when the spec is silent.
5. Prefer the smallest vertical slice that proves the architecture.

When adding a feature:

1. Add or update content/contracts first.
2. Implement pure gameplay behavior without Pixi or React.
3. Add rendering synchronization separately.
4. Expose only the minimum UI snapshot/command changes.
5. Add focused tests and performance counters appropriate to the change.
6. Run `npm run lint` and `npm run build`.

Before declaring completion, check:

- Does React remain outside the frame loop?
- Is authoritative state still outside Pixi objects?
- Does `src/game/**` still follow the approved language boundary (`.ts` for runtime state machines and `.js` elsewhere unless explicitly changed)?
- Can the gameplay behavior run headlessly?
- Are pause, restart, and disposal correct?
- Are temporary objects pooled when they are high frequency?
- Do local damage and Boss split invariants still hold?
- Did the change add a reverse or circular dependency?
- Are new assumptions documented rather than hidden in code?

## 19. Decisions that require user input

Do not silently hard-code these product decisions when they materially affect implementation:

- minimum supported device and concrete entity/Glyph budgets;
- ASCII/Latin-only atlas versus CJK/emoji support;
- fixed single-screen arena versus camera-driven larger world;
- save/replay requirements across content versions;
- analytics/telemetry collection;
- the testing stack to add when tests are first implemented.

Use a conservative temporary default only when it is easy to reverse, and record it next to the relevant contract.
