# Glyph Survivor — AI Engineering Guide

This file is the implementation contract for AI coding agents working in this repository.

Read `spec.md` before designing or changing gameplay. `spec.md` is the product source of truth; this file is the architecture and engineering source of truth. If the two conflict, preserve the product intent in `spec.md` and update this file explicitly instead of silently inventing a third direction.

Before designing or changing weapons, run loadouts, upgrade cards, Module Slots, Module Rank, weapon replacement, or the related UI flow, also read [`docs/content/weapon-system.md`](docs/content/weapon-system.md). That file is the detailed weapon-system content and transaction contract; `spec.md` still wins on product intent, and this file still wins on cross-layer architecture.

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
- Every Enemy, Elite, and Boss is composed of Glyph Cells. Glyph Cells are the smallest authoritative units of creature life and combat.
- Damage always changes Glyph Cell durability. Creature HP and max HP are read-only aggregates derived from Glyph durability, never independent mutable combat state.
- Every Enemy, Elite, and Boss Glyph follows the same `HEALTHY → DAMAGED → HUSK` life cycle. A Husk has zero current durability and cannot take further durability damage, but remains an authoritative, dimly rendered Cell in the creature's full gameplay outline and hitbox.
- A creature starts `COLLAPSING` only when all of its Glyph Cells are Husks. Rewards and cleanup happen only after that whole-body collapse resolves.
- Hit effects must remain local to the DamageShape's actual Impact Cells, including Husks. Durability damage prefers living Cells inside that shape, then advances through the struck body's topology frontier when the local region has already become Husk.
- Creature-specific Body Motion is a deterministic Runtime-owned pose, not renderer-only decoration. Any positional pose offset participates in the authoritative Glyph hitbox, and active Husks follow the same slot motion as living Cells until collapse takes over.
- The first ordinary-enemy appearances progress in the fixed order `ZOMBIE (Z) → BONE (BO) → BAT`; exact stage thresholds, post-unlock mixing, weights, and speeds remain validated content parameters.
- Boss materials must differ in hit response, recovery, destruction, and death behavior.
- Weapon identity comes from target logic, attack shape, and destruction shape—not only numeric damage.
- The confirmed first three weapon identities are the assisted single-target `o`, a short-range approximately 90-degree aimed flamethrower Cone, and a Runtime-owned orbiting `O` with whole-body outward knockback. Their tunable prototype values live in `docs/content/weapon-system.md`.
- Flamethrower sparks are rendering-only particles and never deal damage. The orbiting ball's phase, position, collision, re-hit gating, and knockback are authoritative Runtime state.
- Upgrades should change play patterns and builds, not only add small percentage bonuses.
- Permanent weapon unlocks happen outside a run. A run receives a frozen set of unlocked weapon definitions, starts with exactly one selected weapon, and may acquire only those unlocked weapons through level-up cards.
- Level-up offers mix weapon cards and universal Module cards. The first upgrade must contain at least one eligible weapon card.
- XP overflow is never discarded. Crossing multiple level thresholds queues the same number of upgrade decisions, and gameplay remains paused between those decisions.
- Module investments belong to ordered Slots on one Weapon Instance. A matching Module raises that Slot's Rank; a different Module may overwrite and destroy the selected Slot, but no Module may be moved, refunded, or reassigned to another weapon.
- Replacing a weapon destroys that Weapon Instance's Module Slots and runtime state. It must not mutate the other equipped Weapon Instances.
- Opening the upgrade screen completely pauses gameplay simulation through card, weapon, Module Slot, and weapon-replacement selection until an authoritative commit succeeds.
- Boss splitting redistributes existing Glyphs and durability. It must not increase total Glyph count, current durability, or maximum durability.

## 3. Non-negotiable architecture

The dependency direction is:

```text
React UI
   ↓ commands            ↑ immutable UI snapshots
GameHost / Bridge
   ↓
TypeScript Game Runtime
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
- Use `.ts` for every project-authored executable source/config module and `.tsx` for React components that contain JSX. Do not add `.js` files outside dependencies or generated artifacts.
- Use TypeScript types for module contracts and runtime validation at important cross-boundary entry points.
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

  game/                        Plain ESM TypeScript; never imports React
    host/                      Lifecycle and dependency wiring
      createGameHost.ts

    bridge/                    Cross-boundary contracts
      gameCommands.ts
      uiSnapshot.ts
      renderSnapshot.ts

    runtime/                   Loop, clock, phase, scheduler
      gameMachine.ts
      createGameLoop.ts
      gameClock.ts
      gamePhase.ts
      systemScheduler.ts

    core/                      Engine-agnostic data structures
      entityStore.ts
      eventQueue.ts
      seededRng.ts
      spatialHash.ts
      objectPool.ts

    systems/                   Gameplay behavior
      inputSystem.ts
      movementSystem.ts
      directorSystem.ts
      targetingSystem.ts
      weaponSystem.ts
      projectileSystem.ts
      collisionSystem.ts
      damageSystem.ts
      deathSystem.ts
      dropSystem.ts
      upgradeSystem.ts
      cleanupSystem.ts

    glyph/                     Text-body simulation
      glyphStore.ts
      glyphLayout.ts
      glyphMaterial.ts
      localDamage.ts

    content/                   Validated data definitions
      weapons/
      bosses/
      upgrades/

    rendering/                 The only normal PixiJS dependency boundary
      createPixiApp.ts
      createSceneLayers.ts
      renderSync.ts
      glyphViewPool.ts
      projectileViewPool.ts
      effectViewPool.ts

    persistence/               Settings/save adapters and migrations

  shared/                      Small side-effect-free shared contracts/constants

tests/
  unit/
  integration/
  performance/
  e2e/
```

Do not create generic `utils.ts`, `helpers.ts`, or catch-all `manager` modules. Name modules after one clear responsibility.

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
  <InitialWeaponScreen /> visible in READY before startRun
  <UpgradeScreen />    visible only in PAUSED_UPGRADE
  <PauseMenu />
  <GameOverScreen />
```

The bridge API should remain small and explicit. A representative shape is:

```ts
const gameHost = await createGameHost({ canvas, config })

gameHost.startRun({ seed, initialWeaponDefinitionId })
gameHost.pause()
gameHost.resume()
gameHost.installModule({
  offerId,
  choiceId,
  weaponInstanceId,
  replacedSlotIndex,
})
gameHost.acquireWeapon({
  offerId,
  choiceId,
  replacedWeaponInstanceId,
})
gameHost.updateSettings(settings)
gameHost.restart()
gameHost.dispose()

const unsubscribe = gameHost.subscribeUi((uiSnapshot) => {})
```

Rules:

- `subscribeUi` publishes only UI-sized data: phase, HP, max HP, XP, level, timer, initial weapon choices, upgrade choices, equipped-weapon and Module-Slot summaries, target eligibility, boss summary, and recoverable errors.
- Do not include entity arrays, Glyph arrays, projectiles, particles, Pixi objects, or mutable WorldState references.
- Publish when relevant UI values change or on a low-frequency throttle. Do not publish at display refresh rate by default.
- React StrictMode may mount, clean up, and mount again. GameHost initialization and disposal must not leak a ticker, RAF, event listener, canvas, or asset subscription.
- React controls the initial-weapon and upgrade DOM/UI, including card, target, replacement previews, focus, and animation. Runtime controls whether simulation is paused, which choices and targets are legal, and whether a transaction commits.
- UI preview state may remain local to React, but the final command must include the active offer ID and every authoritative target ID needed for one atomic Runtime validation and commit.

## 7. Game phases and lifecycle

Use an explicit phase/state machine rather than scattered booleans:

```text
BOOT
  → LOADING
  → READY
  → RUNNING
  ↔ PAUSED_MENU
  → PAUSED_UPGRADE
  → RUNNING
  → GAME_OVER
  → DISPOSED
```

Required behavior:

- Asset/config failure stays in `LOADING` or transitions to a documented error state; it must not start a partial simulation.
- `READY` means initialization succeeded and the runtime is waiting for an explicit `startRun` command with a valid initial weapon from the frozen unlock set; fixed simulation steps have not started.
- `PAUSED_UPGRADE` stops fixed simulation steps completely for the whole decision chain: card preview, weapon target, optional Module-Slot or weapon replacement, authoritative commit, and any next queued offer.
- Menu pause stops gameplay time. Rendering may remain static or run at a deliberately reduced rate.
- Repeated `start`, `pause`, `resume`, and `dispose` calls must have defined idempotent behavior.
- Disposal removes DOM listeners, input listeners, ticker/RAF callbacks, subscriptions, scene nodes, and owned GPU resources.
- `COLLAPSING` is an individual creature lifecycle phase, not a global game phase. A collapsing creature no longer participates in targeting, damage, or collision. The runtime owns collapse timing and allows reward/cleanup only after the whole-body collapse resolves, even if an explicit death rule hands its visual fragments to the renderer during that phase.

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

Re-check whether simulation may continue before every catch-up step, not only once at the start of an RAF callback. If an upgrade trigger leaves `RUNNING`, stop the remaining steps immediately and clear the accumulator state that must not cross the pause boundary. This is required for a genuinely complete upgrade pause.

Each fixed step runs systems in a stable order:

```text
Input sample
→ Movement
→ Spawn / Director
→ Targeting / Weapons
→ Projectile movement / Collision
→ Damage / Glyph material response
→ Death detection / Boss split / Creature collapse / Drops / XP
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

Derive an independent upgrade-offer RNG stream from the run seed. Enemy spawning, AI, combat, and rendering randomness must not change the sequence of weapon／Module offers for the same upgrade state.

### World and camera

- The gameplay world is a fixed `4000 × 4000` world-unit square. The render canvas remains viewport-sized; do not allocate a `4000 × 4000` HTML canvas or render texture for the world.
- The camera follows the player in world coordinates and keeps the player at the viewport center.
- Keep the camera viewport inside the world by constraining player movement to camera-safe playable bounds. Do not expose empty space outside the world merely to keep the player centered.
- Freeze the world dimensions for the duration of a run. Resizing the browser changes the viewport and camera-safe bounds, not the world dimensions.
- Gameplay, collision, AI, spawning, and authoritative positions use world coordinates. Apply the camera transform only when producing or consuming render-space data.
- Convert pointer screen coordinates back into world coordinates before deriving aim or target direction.
- Render snapshots should contain only entities inside the camera viewport plus a deliberate render margin when offscreen population would otherwise add unnecessary synchronization or GPU work.

### Enemy spawn rules

- Ordinary enemies spawn in a ring outside the current camera viewport. Valid candidates are `150` to `300` world units beyond the visible camera bounds.
- Ordinary enemies must never spawn inside the player's visible viewport.
- Reject candidates that intersect an obstacle or overlap another enemy's gameplay footprint. Use a spatial query suitable for the active population; do not scan every enemy for every spawn attempt once counts are high.
- Limit spawn attempts per request. If no valid candidate is found, defer or skip that spawn instead of forcing an invalid position.
- Bias ordinary enemy spawning toward the player's movement direction: approximately `60%` of spawn selections should come from the forward side or forward region. Use the injected seeded RNG so the result is reproducible.
- Determine the eligible ordinary-enemy definitions from content-defined progression before selecting a spawn definition. First appearances must preserve `Z → BO → BAT`; `BO` cannot appear during the initial `Z` stage and `BAT` cannot appear before the `BO` stage. Do not hard-code unconfirmed thresholds, weights, or speeds into the director.
- Select the ordinary-enemy definition before validating a spawn candidate, because its full broad-phase footprint includes its body, maximum material deformation, and maximum authoritative Body Motion offset.
- Elite enemies may use validated, content-defined fixed spawn points instead of the ordinary camera ring.
- Bosses spawn only from explicit gameplay events or content-defined scene locations. Do not route Boss spawning through the ordinary enemy director.
- Every enemy enters through a `0.3` to `0.5` second text-aggregation spawn phase so it does not pop into view instantly. The runtime owns the seeded duration, spawn phase, and transition to active gameplay; the renderer only visualizes that state and must not decide when the enemy becomes active.

## 10. Glyph model

A Glyph Cell needs enough data to support the spec:

```ts
interface GlyphCell {
  id: number
  ownerId: number
  character: string
  glyphFrame: number
  localX: number
  localY: number
  bodyMotionOffsetX: number
  bodyMotionOffsetY: number
  currentDurability: number
  maxDurability: number
  alpha: number
  material: GlyphMaterialId
  state: GlyphCellState
  rotation: number
  offsetX: number
  offsetY: number
  velocityX: number
  velocityY: number
  scale: number
  flags: number
}
```

This is a conceptual contract; `GlyphMaterialId` and `GlyphCellState` are domain types whose concrete representation belongs to the Glyph model. Optimize storage after measurement. Encoded characters, enum values, and parallel typed arrays are acceptable as long as the logical fields and behavior remain intact. For high counts, prefer packed arrays, struct-of-arrays, or paged typed arrays over thousands of class instances.

Preserve the distinction between:

- anchor/local position: the body's intended shape;
- Body Motion offset/rotation: the deterministic, species-specific pose layered over the current anchor;
- offset/velocity: temporary deformation, knockback, scattering, and recovery;
- current/max durability: authoritative local life and its initial capacity;
- material: local hit response, displacement, recovery, and destruction rules;
- state: exactly the living progression `HEALTHY`, `DAMAGED`, or `HUSK` for active creature Glyphs;
- render alpha/tint: visual output derived from gameplay state.

The state and durability invariants are:

```text
HEALTHY: currentDurability === maxDurability
DAMAGED: 0 < currentDurability < maxDurability
HUSK: currentDurability === 0
```

A Glyph with `maxDurability === 1` may transition directly from `HEALTHY` to `HUSK`; do not create hidden durability merely to force a visible `DAMAGED` step. A Husk cannot take durability damage, recover durability, or revive. While its creature is active, it must retain its stable Glyph ID, an authoritative owner ID, maximum durability, anchor/local position, deformation data, and gameplay outline footprint. Explicit body reassembly, morph, or validated Boss-split rules may update its anchor or owner without changing its identity or durability. It remains visible at deliberately low alpha/tint so the creature silhouette does not shrink as it is consumed.

The authoritative pose composition is:

```text
worldGlyphPosition = creatureRootPosition
                   + layoutAnchor
                   + bodyMotionOffset
                   + deformationOffset
```

Root movement, structural layout/morph, Body Motion, and hit/material deformation are separate responsibilities and must not overwrite one another. Body Motion position affects precise collision and DamageShape queries. Rotation must be included in render snapshots; it affects gameplay geometry only when that geometry is orientation-dependent. A circular Glyph hitbox follows the authoritative translated center but does not change shape merely because its rendered Glyph rotates.

### Creature Body Motion

- Creature content selects a validated Body Motion strategy/profile; do not grow a central species `switch` in `movementSystem`.
- Evaluate Body Motion during fixed simulation steps after root movement and structural layout. Ordinary `Z`, `BO`, and `BAT` motion runs only while the owner is `ACTIVE`; other lifecycle phases require an explicit content rule.
- All active outline Cells assigned to a motion slot participate regardless of `HEALTHY`, `DAMAGED`, or `HUSK` state. Collapse presentation is a separate lifecycle behavior.
- Derive every step from the stable current layout anchor plus normalized phase. Never accumulate the previous step's pose offset or rotation.
- Instance desynchronization must be stable and reproducible, using a stable ID-derived phase or seeded spawn state. Do not consume per-frame randomness.
- Prepare slot-to-motion-group bindings during content loading. The hot path computes phase and movement intensity once per owner, samples each motion channel once, and applies the result without allocating temporary objects, arrays, closures, or maps.
- Reuse a sampled group transform for every Cell assigned to that group. Do not repeat identical easing, keyframe searches, or trigonometric work per Cell.
- Per-step complexity must remain `O(active animated creatures + animated outline Glyphs)`. Never scan unrelated owners or run topology searches for pose animation.
- Validate and compile a maximum Body Motion positional offset into each creature's broad-phase radius.

Do not use one state check to answer unrelated questions. Define explicit Glyph predicates or queries for at least:

- living/damageable: `HEALTHY` or `DAMAGED`;
- outline/hitbox participation: `HEALTHY`, `DAMAGED`, or `HUSK` while the creature is active;
- rendering: all three states until runtime-authorized cleanup;
- living topology/connectivity: `HEALTHY` or `DAMAGED`, unless a content rule explicitly defines otherwise.

Every Enemy, Elite, and Boss owns one or more Glyph Cells. Do not add an authoritative mutable `hp` field to these creature entities. If UI, AI, phase logic, or content needs creature HP, compute or cache a derived aggregate whose invalidation is owned by `GlyphStore`:

```text
currentHp = sum(currentDurability for HEALTHY or DAMAGED glyphs owned by the creature)
maxHp = sum(maxDurability for glyphs owned by the creature)
```

Any cached aggregate is disposable derived data and must never diverge into a second damage model. Weapons, hazards, damage-over-time effects, phase transitions, and death rules must operate on or observe Glyph Cells; they must not subtract from creature HP directly.

Local damage flow separates impact visualization from durability targets:

1. Weapon emits a `DamageShape`, damage amount, and impact parameters.
2. Spatial index returns candidate outline Glyphs; entity-level collision may be used only as a broad phase.
3. A precise shape test produces the **Impact Cells**: every distinct `HEALTHY`, `DAMAGED`, or `HUSK` Cell intersecting the DamageShape.
4. If there are no Impact Cells, the attack misses. If there are Impact Cells, local hit flash, particles, material displacement, and other impact effects apply only to those Cells, regardless of their life state.
5. For each struck creature/body, select **Damage Targets** only from its living/damageable Cells. Prefer living Impact Cells first, then use a deterministic multi-source topology-frontier search outward from the struck region to fill the attack's target quota. The frontier may eventually reach a living Cell at the other end of the body; do not make an attack ineffective merely because its local Impact Cells are already Husks.
6. A single-target/point attack has a quota of `1`. An area attack's per-body `targetQuota` equals the number of distinct outline Cells of that body in its Impact Cells. Each living Cell may be selected at most once by that attack; an unfilled quota is discarded rather than stacked repeatedly onto a surviving Cell.
7. Apply durability damage only to the selected Damage Targets. A remote frontier target receives no local hit flash, particle, impulse, or other impact effect unless it was also an Impact Cell.
8. A Glyph whose durability reaches zero enters `HUSK`, keeps its gameplay outline footprint, and becomes immune to further durability damage.
9. When the owner has no living Glyphs, transition the creature to `COLLAPSING`; only after collapse resolution may death rewards and cleanup occur.

Damage selection must be local-first and topology-driven, never random or transferred to another owner. Never implement damage by subtracting creature HP first, damaging every Glyph uniformly, reducing a whole creature container's alpha, or using render state as the hitbox source of truth.

## 11. Boss and material rules

Boss behavior should be composed from data and strategies instead of a single giant switch.

A Boss definition should separate:

- layout/body generation;
- movement/AI;
- rhythmic Body Motion or an explicit `NONE` profile when structural morph already provides its motion identity;
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

Materials belong to Glyph Cells, even when a creature definition supplies one default material for its whole body. A material must affect the hit Glyphs' durability or physical response; it cannot be only a renderer-wide effect.

For every split operation, test these invariants:

```text
glyphCountBefore === glyphCountAfter
sumCurrentDurabilityBefore === sumCurrentDurabilityAfter
sumMaxDurabilityBefore === sumMaxDurabilityAfter
every original glyphId has exactly one new owner
no Glyph is copied or lost
no new combat durability is created
```

## 12. Weapon and upgrade rules

Read [`docs/content/weapon-system.md`](docs/content/weapon-system.md) before changing this area. It defines the detailed permanent-unlock boundary, run acquisition, mixed three-card offers, ordered Module Slots, Rank upgrades, overwrite behavior, atomic commands, replacement semantics, UI flow, and prototype defaults. Do not duplicate a conflicting version of those rules in code comments or another document.

Separate weapon concerns:

```text
TargetStrategy       nearest, cone, random, chain candidate, manual aim
AttackPattern        single, burst, spread, beam, orbit, chain
DamageShape          point, circle, capsule, line, cone
DestructionProfile   knockback, pierce, explosion, split, erosion
```

Content definitions may select strategies and parameters. They must not contain hidden mutable runtime state.

Use discriminated combat profiles. A Cone attack must not carry fake projectile speed／tracking fields, and a persistent orbit must not masquerade as a projectile solely to reuse an existing system. Each AttackPattern owns only the state and parameters it actually requires.

Weapon content and runtime state must remain separate:

- A prepared Weapon Definition is immutable content: stable ID, UI metadata, Module Slot count, strategy selections, base combat parameters, and explicit tracking profile where applicable.
- A Weapon Instance is authoritative run state: stable instance ID, equipment position, independent cooldown／attack sequence, ordered Module Slots, and a revision for derived combat data.
- A Module Definition is immutable content with a stable ID, content-defined maximum Rank, and explicit effects for each Rank.
- A Module Slot is authoritative run state containing either nothing or one module definition ID plus Rank. Slot usage is not a second independently mutable capacity total.
- `ResolvedWeaponProfile` is disposable derived data compiled from the Weapon Definition plus ordered Slots. Rebuild it only when Slots or Ranks change; never treat it as the investment source of truth.

The first-pass `maximumEquippedWeapons` default is `3`, but it must live in validated run／content configuration rather than repeated literals. Every first-pass Weapon Definition must explicitly declare exactly `4` Module Slots; Runtime and UI must read that prepared value instead of repeating a magic number. First-pass Modules occupy one Slot, and one Weapon Instance cannot hold the same Module in multiple Slots.

Module placement follows one deterministic transaction rule:

1. If the same Module exists below maximum Rank, increase that Slot by one Rank.
2. Otherwise, if an empty Slot exists, install Rank I into the first empty Slot.
3. Otherwise require an explicit Slot index, destroy only that Slot's previous Module, and install the new Module at Rank I.
4. A Weapon Instance whose matching Module is already at maximum Rank is not an eligible target for that card.

Weapon replacement is also atomic. Below the equipment limit, create a new empty Weapon Instance. At the limit, require an explicit replacement instance, preserve its equipment position, discard all of its Modules and instance-owned runtime state, and leave every other Weapon Instance unchanged. Independent in-flight attacks use their spawn-time resolved snapshot; instance-attached attacks need an explicit termination rule.

Every level-up offer contains exactly three unique choice references and a stable offer ID. Choices may be `WEAPON` or `MODULE`; weapon choices come only from the run's frozen unlock set. The first offer guarantees at least one eligible, unlocked, unequipped weapon. Use a dedicated seeded upgrade RNG and stable content ordering. Exact later weights are content parameters, not system constants.

Level progression uses validated content for `xpToNext(level)` and reward values. Add XP into the current-level remainder, repeatedly consume crossed thresholds, preserve overflow, and queue one upgrade decision per crossed level. Determine the first-weapon-card guarantee from the first generated offer sequence, not from an assumed player level. Boss／Elite rewards require explicit content values and must not accidentally inherit an ordinary-enemy fallback.

React selection previews do not mutate the run. Final install／acquire commands must revalidate the active offer, choice kind, instance IDs, Rank, empty/full Slot state, and replacement target. Invalid or stale commands consume nothing, change nothing, and keep gameplay paused. Successful validation commits all changes atomically before consuming the offer or resuming.

Every damaging attack defines a `DamageShape`, its geometric dimensions such as radius/length/angle, and a damage amount. A shape intersects the full authoritative creature outline, including Husks. A point-like attack selects one living Damage Target from the struck body; area shapes derive each struck body's quota from the number of its distinct intersected outline Cells. In-shape living Cells are selected first, and deterministic topology-frontier selection fills any remaining quota. DamageShape intersection and durability-target selection are separate from local visual effects: only the actual in-shape Impact Cells receive those effects. Entity-level collision may be used only as a broad phase before Glyph-level queries and precise shape tests.

Gameplay projectiles are the only projectile-like objects that participate in damage/collision. Visual particles are rendering-only and never cause damage.

- The flamethrower's authoritative damage comes from fixed-step Cone DamageShape pulses. Its orange／yellow `.`, `*`, and related sparks only visualize that shape; changing their density must not change gameplay.
- An orbiting ball that damages enemies is an instance-attached authoritative attack. Runtime owns its deterministic orbit phase, world position, collision radius, per-owner re-hit gating, pause behavior, and cleanup when its Weapon Instance disappears. Renderer-owned halo and trail particles do not collide.
- When a weapon explicitly applies whole-body knockback, Runtime displaces the creature root in an authoritative, bounded way so every active outline Glyph, including Husks, follows it. Local Material impulse and hit presentation remain restricted to actual Impact Cells; topology-frontier-only Damage Targets receive neither.

- Every fired gameplay projectile uses an explicit tracking profile.
- `ASSISTED` projectiles may make limited corrections toward their initial target, but permanently become ballistic after passing or losing that target. They must not reacquire or turn back.
- `HOMING` projectiles may use stronger steering, keep targets behind them, and reacquire through a budgeted spatial query after target loss.
- Target IDs, target validity, steering, and reacquisition are authoritative runtime concerns. The renderer only visualizes projectile positions.

Upgrade effects should produce explicit modifiers or strategy changes. Avoid scattered checks such as `if (hasUpgradeX)` across unrelated systems.

A universal Module must have a meaningful, validated interpretation for every weapon allowed to receive it. Attack area, targeting／travel range, duration, projectile count, pierce, knockback, and element are separate capability axes; do not collapse them into ambiguous fields or silently offer no-op cards. Compose Rank effects in a stable order and keep the fixed-step firing path free of per-step modifier allocations.

New combat features must first define their Glyph interaction instead of modifying creature HP. For example, fire applies durability damage over time, freezing changes Glyph displacement/material response, corrosion damages and fades Glyphs, lightning selects adjacent Glyphs, and black holes attract and deform Glyphs.

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
- The first release uses a Printable ASCII glyph atlas. Expanding the required gameplay atlas to CJK or emoji is a separate product and performance decision.
- Do not use `Text` or `HTMLText` for per-frame-updated high-volume Glyphs.
- `Text` is acceptable for small, static, or infrequently changed labels.
- `BitmapText` is suitable for frequently changing counters or longer text whose characters do not need independent gameplay ownership.
- For high-volume independent Glyph views, use atlas frames with pooled `Particle`/`Sprite` views according to required features.
- `ParticleContainer` is appropriate only when particles share a base texture and do not require per-particle filters, masks, events, or blend modes.
- Set only actually animated `dynamicProperties` on `ParticleContainer`.
- Synchronize authoritative Glyph rotation through the render snapshot when a motion profile uses it. Before enabling rotation uploads on a shared high-population layer, measure the cost; if it is material, partition rotating and non-rotating Glyph batches without creating per-creature containers or display objects.
- Set `boundsArea` when using `ParticleContainer`, especially with culling.
- Group similar object types, base textures, and blend modes to preserve batching.
- Use object pools for projectiles, Glyph fragments, damage particles, and short-lived effects.
- Disable interaction (`eventMode = 'none'`) on non-interactive world subtrees.
- Use culling only after profiling; it trades CPU bounds checks for less rendering.
- Do not enable high resolution or antialiasing without target-device profiling.
- Never change `Text.text` every frame unless guarded by a real value change; prefer bitmap text for dynamic counters.

The visual representation may use an atlas texture internally. This does not violate the product rule that a Glyph is a living Cell: gameplay identity lives in `GlyphStore`, while the texture is only a batched rendering technique.

A Husk is not ordinary rendering debris: while its creature is active it remains an authoritative part of the full gameplay outline and must not be converted into a rendering-only fragment. Only after every owned Glyph is a Husk, the runtime explicitly enters `COLLAPSING`, and the creature is removed from targeting, damage, and combat collision may an explicit death rule hand the collapsing Glyph visuals to rendering-only fragments. The runtime still owns collapse timing and must not issue death rewards or cleanup before that presentation resolves. A displaced, scattered, damageable, reassembling, or active Husk Glyph retains its gameplay ID and authoritative state until the runtime explicitly resolves its mechanic.

## 14. Input rules

- Keyboard and pointer input belong to an `InputAdapter`, not React state.
- Store key/button state and the latest pointer position, then sample them at the start of each fixed step.
- Convert pointer coordinates into world coordinates through the render/camera adapter.
- Update the player's stored aim direction only when the pointer position revision changes. Player movement, camera following, fixed-step catch-up, and viewport resize must not rotate an idle pointer's aim direction.
- Input events enqueue commands or update input state; they must not mutate entities directly.
- Remove all listeners during GameHost disposal.

## 15. Performance budgets and degradation

Do not optimize blindly, but design hot paths so they can be measured.

Initial engineering targets, subject to target-device validation:

- Desktop frame p95: at or below 16.7 ms.
- Reduced-quality frame p95: at or below 33 ms.
- Simulation step p95 in ordinary combat: at or below 6 ms.
- Simulation step p95 in the agreed Boss stress case: at or below 10 ms.

The agreed first-pass validation platform is a modern desktop or laptop browser at 1080p, with approximately four CPU cores, integrated graphics, and 8 GB RAM. Mobile is not guaranteed in the first release.

Use these reproducible benchmark populations as engineering scenarios, not runtime hard caps. Preserve the agreed living-Glyph populations and record retained Husks separately; this rule change does not silently establish a new total retained-Glyph budget:

- Ordinary combat: approximately 300 creatures, 2,000 Living Glyphs (`HEALTHY` or `DAMAGED`), retained Husk count reported separately, 500 gameplay projectiles, and 2,000 visual particles.
- Boss stress: approximately 500 creatures, 5,000 Living Glyphs (`HEALTHY` or `DAMAGED`), retained Husk count reported separately, 1,000 gameplay projectiles, and 5,000 visual particles.

A concrete total retained-Glyph benchmark or hard cap requires explicit user agreement because Husk retention increases render and synchronization population without changing combat HP.

Regular play targets 60 FPS. Reduced quality may target 30 FPS in the Boss stress scenario while fixed simulation semantics remain unchanged.

Track at minimum:

- frame time and simulation time;
- Body Motion simulation time, animated creature count, and animated outline-Glyph count when profiling this feature;
- active entity/projectile/effect counts and Glyph counts split by `HEALTHY`, `DAMAGED`, and `HUSK`;
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

Creature Body Motion hot paths must satisfy the following before visual tuning is accepted:

- normalized phase and movement intensity are computed once per active owner per fixed step;
- motion-channel transforms are sampled once and reused across their compiled slots;
- no per-step allocations, string/character dispatch, topology searches, or per-Cell RNG occur;
- repeated trigonometric or keyframe work is not performed independently for every Cell;
- active Husks remain included in authoritative motion and retained-Glyph counts;
- broad-phase and precise Glyph collision continue to use the same animated world positions as rendering.

## 16. TypeScript standards for `src/game/**`

- Use ESM imports/exports.
- Keep every project-authored source file at or below 500 physical lines. Treat 400 lines as the point to reassess whether the module has more than one responsibility.
- Split large modules by named responsibility, using specific names such as `cameraTransform.ts` or `spawnGeometry.ts`. Do not create generic `utils.ts`, `helpers.ts`, or dumping-ground modules to satisfy the line limit.
- Use descriptive function and variable names.
- Prefer small modules and pure functions for rules/calculations.
- Use factory functions when lifecycle or injected dependencies matter.
- Use classes only when identity and lifecycle genuinely benefit from them.
- Avoid module-level mutable singletons except documented Pixi/asset infrastructure.
- Validate content, save data, and cross-boundary commands at entry points.
- Handle async initialization errors explicitly.
- Name constants instead of scattering magic numbers.
- Use explicit TypeScript interfaces and type aliases for exported contracts and non-obvious public functions.
- Comment why a constraint exists; do not narrate obvious code.
- Keep performance mutations inside owned stores and document the ownership boundary.
- Prefer guard clauses over deeply nested control flow.

## 17. Testing contract

Gameplay logic must be testable without rendering a canvas.

Testing is selective and risk-driven, not coverage-driven:

- Add tests only for necessary pure functions and high-risk deterministic gameplay invariants.
- Do not use line, branch, function, or statement coverage percentages as delivery KPIs.
- Do not add tests solely to increase coverage or mirror implementation details.
- Integration, bridge, lifecycle, performance, and E2E tests are not required by default. Add them only when the user explicitly requests them.
- Prefer pure tests for geometry, coordinate conversion, fixed-step calculations, seeded selection, weapon／Module offer eligibility, Module-Slot transactions, replacement invariants, collision and damage shapes, Impact Cell/Damage Target separation, topology-frontier target selection, Glyph material and Husk rules, and Boss split invariants.
- Rendering and orchestration code may remain without automated tests when extracting a pure function would make the design less clear.

Use behavior-focused names, for example:

```text
keeps husks in the gameplay outline without damaging them again
prioritizes living impact cells before topology-frontier targets
uses the number of distinct outline impact cells as the area target quota
applies hit effects only to impact cells, including husks
does not emit local impact effects for topology-frontier-only damage targets
starts collapse only after every owned glyph becomes a husk
preserves total glyph hp when slime splits
rejects spawn positions inside the camera viewport
converts pointer coordinates through the inverse camera transform
selects the same spawn region with the same seed and movement vector
preserves the first-appearance progression from Z to BO to BAT
returns body motion to the same pose without accumulating drift
keeps active husks on the same body-motion track as living glyphs
keeps the zombie bottom pivot stable while its glyph center moves
preserves XP overflow and queues one decision for every crossed level
guarantees an eligible weapon card in the first upgrade offer
intersects the aimed cone with authoritative glyph circles including husks
keeps flame-particle density from changing authoritative cone damage
upgrades a matching module in place without consuming another slot
replaces only the selected full module slot and resets it to rank one
rejects a stale upgrade offer without consuming it or resuming gameplay
replaces one weapon and discards only that weapon's module slots
keeps gameplay paused through card, weapon, and replacement selection
keeps in-flight attack values unchanged after replacing their source weapon
clears persistent orbit attacks when their weapon instance is replaced
```

## 18. AI implementation workflow

Before changing code:

1. Read the relevant section of `spec.md`.
2. For weapon, loadout, Module, upgrade-card, or replacement work, read `docs/content/weapon-system.md` completely.
3. Inspect nearby code and the current repository structure.
4. Identify the owning layer and verify dependency direction.
5. State assumptions only when the spec and relevant content document are silent.
6. Prefer the smallest vertical slice that proves the architecture.

When adding a feature:

1. Add or update content/contracts first.
2. Implement pure gameplay behavior without Pixi or React.
3. Add rendering synchronization separately.
4. Expose only the minimum UI snapshot/command changes.
5. Add tests only for necessary pure functions and high-risk gameplay invariants; test coverage is not a delivery KPI. Add performance counters appropriate to the change.
6. Run `npm run lint` and `npm run build`.

Before declaring completion, check:

- Does React remain outside the frame loop?
- Is authoritative state still outside Pixi objects?
- Are all project-authored executable source/config modules still `.ts` or `.tsx`, with no new `.js` files outside dependencies or generated artifacts?
- Can the gameplay behavior run headlessly?
- Are pause, restart, and disposal correct?
- Are temporary objects pooled when they are high frequency?
- Do local damage and Boss split invariants still hold?
- Did the change add a reverse or circular dependency?
- Are new assumptions documented rather than hidden in code?

## 19. Decisions that require user input

Do not silently hard-code these product decisions when they materially affect implementation:

- changes to the agreed minimum device or concrete entity/Glyph benchmark budgets;
- expanding the first-release Printable ASCII atlas requirement to CJK or emoji;
- save/replay requirements across content versions;
- analytics/telemetry collection;
- the testing stack to add when tests are first implemented;
- weapons beyond the confirmed first three, permanent unlock conditions, Module Rank tables beyond the confirmed prototype set, offer weights, element coexistence rules, weapon evolution gates, and any ability that changes the equipment limit or preserves investments during replacement.

Use a conservative temporary default only when it is easy to reverse, and record it next to the relevant contract.
