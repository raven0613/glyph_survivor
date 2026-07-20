# Glyph Survivor — AI Engineering Guide

This file is the implementation contract for AI coding agents working in this repository.

Read `spec.md` before designing or changing gameplay. `spec.md` is the product source of truth; this file is the architecture and engineering source of truth. If the two conflict, preserve the product intent in `spec.md` and update this file explicitly instead of silently inventing a third direction.

Before designing or changing weapons, run loadouts, upgrade cards, Module Slots, Module Rank, weapon replacement, or the related UI flow, also read [`docs/content/weapon-system.md`](docs/content/weapon-system.md). That file is the detailed weapon-system content and transaction contract; `spec.md` still wins on product intent, and this file still wins on cross-layer architecture.

Before designing or changing player health, shields, incoming player damage, player contact collision, player death, run results or statistics, the game-over flow, return to the main menu, or related survival Module cards, also read [`docs/content/player-survival.md`](docs/content/player-survival.md). That file is the detailed player-survival and run-settlement contract; survival Module cards are additionally subject to [`docs/content/weapon-system.md`](docs/content/weapon-system.md). `spec.md` still wins on product intent, and this file still wins on cross-layer architecture.

Before designing or changing Run Modifiers, Boss Modifier rewards, the run-start Modifier testing offer, `PAUSED_MODIFIER`, Glyph Cell negative statuses, Modifier damage composition, Modifier presentation, Volatile reaction chains, Disconnected topology classification, Overload／Cracked behavior, or the related UI flow, also read [`docs/content/run-modifiers.md`](docs/content/run-modifiers.md) completely. That file is the detailed Run Modifier content, presentation, testing, and transaction contract; it does not replace the weapon／Module or player-survival contracts.

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
- Damage dealt to an Enemy, Elite, or Boss always changes Glyph Cell durability. Creature HP and max HP are read-only aggregates derived from Glyph durability, never independent mutable combat state.
- Every Enemy, Elite, and Boss Glyph follows the same `HEALTHY → DAMAGED → HUSK` life cycle. A Husk has zero current durability and cannot take further durability damage, but remains an authoritative, dimly rendered Cell in the creature's full gameplay outline and hitbox.
- A creature starts `COLLAPSING` only when all of its Glyph Cells are Husks. Rewards and cleanup happen only after that whole-body collapse resolves.
- Primary hit effects remain local to the DamageShape's actual Impact Cells, including Husks. Direct durability damage prefers living Cells inside that shape. When the local region is Husk, each source Impact Cell first follows the attack's authoritative forward traversal direction to the first aligned living Cell; only a direction that contains no living Cell may fall back to the nearest canonical-topology frontier and expand sideways. A remote target does not take damage or change brightness until a Runtime-owned, lower-emphasis Cell-by-Cell topology pulse reaches it; never draw a source-to-target line. An explicit Damage Spread profile remains a separate living-only exterior-band rule and does not traverse Husks unless a future ability explicitly opts into the Area directional policy. Neither secondary presentation inherits the primary Material impulse implicitly.
- Creature-specific Body Motion is a deterministic Runtime-owned pose, not renderer-only decoration. Any positional pose offset participates in the authoritative Glyph hitbox, and active Husks follow the same slot motion as living Cells until collapse takes over.
- The first ordinary-enemy appearances progress in the fixed order `ZOMBIE (Z) → BONE (BO) → BAT → ROCK → SNAKE`. Each appearance has a content-defined earliest Gameplay-time gate, but the next species remains locked until the previous one successfully commits its first spawn. Exact gates, post-unlock mixing, weights, and speeds remain validated content parameters; player kill count is not the first-pass appearance gate.
- `BO` uses a vertical two-slot Body Blueprint with `O` above `B`. Body layout and Body Motion are independent contracts: this layout keeps the existing BONE motion profile and deterministic per-instance phase variation.
- The confirmed ordinary-enemy palette identities are dark green-family `Z`, dark bone-white／warm-neutral-family `BO`, deep moderately saturated purple-family `BAT`, cool rock-gray-family `ROCK`, and dark saturated teal-family `SNAKE`. Their base palettes should read as dark rather than pale, pastel, or washed out. Equivalent ordinary-enemy presentation states use the same ordinary brightness-emphasis tier, but that tier describes shared role ordering and highlight strength—not equal base-color lightness or narrowly equal effective luminance across hues. Primary hit feedback brightens only within the struck creature's own palette; Damage Spread secondary feedback follows the source player-attack role's accent palette. The green-family `SLIME` Boss also keeps a dark, saturated base palette; its Boss-tier emphasis is stronger than the ordinary tier at corresponding active／impact roles but remains below player attacks.
- A newly spawned XP drop begins in a fresh-yellow state, shortly settles into dark gold, and thereafter flashes only occasionally with a low duty cycle and deterministic per-drop staggering. Its configured fresh and flash peaks must remain below every player-attack core brightness tier.
- One structurally validated combat visual theme is the sole authoring source of truth for combat-world base palettes, alpha, brightness-emphasis tiers, outlines, and XP palette-transition／flash timing. Every tunable color literal in that authoring config uses strict `#RRGGBB` string form; alpha remains a separate numeric field. Product documents preserve semantic color identities and ordering targets, but Runtime preparation must not reject a valid color because of its hue, saturation, lightness, or effective luminance. Content, systems, render adapters, and React styles must not duplicate battle-canvas color values.
- Boss materials must differ in hit response, recovery, destruction, and death behavior.
- Weapon identity comes from target logic, attack shape, and destruction shape—not only numeric damage.
- The confirmed first three weapon identities are the assisted single-target `o`, a short-range approximately right-angle aimed flamethrower Cone, and a Runtime-owned orbiting `O` with whole-body outward knockback. Their semantics live in `docs/content/weapon-system.md`; current tunable values live only in the validated weapon authoring modules linked from that document.
- Flamethrower sparks are rendering-only particles and never deal damage. The orbiting ball's phase, position, collision, contact episodes, re-hit gating, and knockback are authoritative Runtime state. Each ball／creature-owner pair may hit immediately on a new or re-entered contact episode; only continuous overlap is throttled by its prepared `rehitCooldownMs`, and the gate commits only after Damage System confirms at least one Impact Cell.
- Upgrades should change play patterns and builds, not only add small percentage bonuses.
- Projectile Count is a prepared total-count effect whose Rank payloads and centered assisted／Cone spacing come only from the prepared Module config. One assisted volley shares one initial target query and one selected stable owner／anchor; Cone streams use independent attack-event IDs; orbit balls share one base phase and divide the full orbit evenly. A multi-component owner may expose a bounded set of stable assisted-target anchors, scored by miss distance to the unassisted authoritative firing trajectory—using the pre-spacing base aim axis for a volley—without becoming multiple creatures, HP pools, hitboxes, or rewards. Locking saves the chosen anchor ID and must not switch anchors every fixed step.
- Range is a complete-Rank-multiplier contract whose current Rank payloads come only from prepared Module config. It increases assisted acquisition／lock／path-distance reach, authoritative Cone length, or an orbit's maximum radial-sweep radius while preserving that orbit's base radius and contact-circle size. It never enlarges Damage Spread bands or silently changes projectile speed, Cone angle, cadence, or re-hit cooldown.
- Permanent weapon unlocks happen outside a run. A run receives a frozen set of unlocked weapon definitions, starts with exactly one selected weapon, and may acquire only those unlocked weapons through level-up cards.
- Level-up offers mix weapon cards and universal Module cards. The first upgrade must contain at least one eligible weapon card.
- XP overflow is never discarded. Crossing multiple level thresholds queues the same number of upgrade decisions, and gameplay remains paused between those decisions.
- Module investments belong to ordered Slots on one Weapon Instance. A matching Module raises that Slot's Rank; a different Module may overwrite and destroy the selected Slot, but no Module may be moved, refunded, or reassigned to another weapon.
- Replacing a weapon destroys that Weapon Instance's Module Slots and runtime state. It must not mutate the other equipped Weapon Instances.
- Opening the upgrade screen completely pauses gameplay simulation through card, weapon, Module Slot, and weapon-replacement selection until an authoritative commit succeeds.
- Boss splitting redistributes existing Glyphs and durability. It must not increase total Glyph count, current durability, or maximum durability.
- Run Modifiers are Runtime-owned world rules for the current run, not Weapon Modules. They occupy no Module Slot, survive weapon replacement, disappear with the run, may coexist when their definition IDs differ, and cannot be acquired twice unless a future explicit Rank contract says otherwise. Because a Boss reward may arrive before the Weapon／Module Build is mature, every first-pass Modifier must create a useful decision on its own rather than require a particular weapon, Module, Rank, or another Modifier to function.
- A Boss Encounter authorizes exactly one Modifier reward only after its complete collapse resolves and it formally enters `DEFEATED`. The reward offers three unique unowned definitions when possible, two when exactly two remain, and one normal choice when exactly one remains; a one-choice offer still requires explicit confirmation and never auto-acquires. The zero-eligible fallback remains an explicit future decision. Modifier rewards never enter the XP weapon／Module offer domain.
- Modifier development may enable one validated Boolean Runtime config flag, `enableRunStartModifierOfferForTesting`. It authorizes exactly one normal Modifier offer after a valid initial Weapon Instance exists but before the first fixed step. It never consumes a Boss token or advances the Boss-offer RNG domain; the selected definition becomes genuinely owned, so the later Boss reward excludes it normally. The release path keeps the flag false.
- The confirmed first Run Modifiers are `VOLATILE`, `DISCONNECTED`, and `OVERLOAD`. Their formulas, damage-route interaction matrix, Cell-status payloads, Slime latch behavior, reward transaction, and prototype-config semantics live only in `docs/content/run-modifiers.md`; current tunable authoring values live in the validated config modules linked from that document and must not be duplicated as document defaults.
- Volatile is initially a same-owner, canonical-topology depth-one reaction. Every stable Glyph can emit at most one Volatile explosion when it first enters `HUSK`; chained events advance in Runtime-owned breadth-first waves separated by the frozen content-defined Gameplay simulation-time interval, and no authoritative event may be discarded because a fixed-step processing budget, pool, renderer, or particle budget is exhausted.
- Disconnected classifies Living canonical connected components, never screen-space separation. Overload applies a non-damaging, non-stacking `CRACKED` status to Living canonical neighbors after a sufficiently heavy direct hit; Crack affects only a later direct attack from a different root attack event.
- Modifier bonuses are composed once from the same base direct damage and committed through one authoritative durability-application boundary. Modifier handlers must not recursively multiply one another, duplicate Damage Spread, inherit unrelated Material impulse, or grow scattered `if (hasModifierX)` branches across weapon systems.
- Modifier presentation uses short attack／hold／settle beats with a visible stop point and a fast, clean finish. Disconnected owns restrained component-level instability, Overload owns one directional compression／radial impact plus a persistent cracked surface, and Volatile owns discrete topology-wave pulses. Long glow tails, continuous ambient shaking, radial Volatile rings, and unbounded status-effect stacking violate their visual identities.

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

- Keep React limited to UI, menus, settings, HUD, choices, overlays, and React-owned non-gameplay DOM screens.
- Implement the game loop, gameplay state, systems, and PixiJS canvas code as ordinary ESM modules under `src/game/**`.
- Use `.ts` for every project-authored executable source/config module and `.tsx` for React components that contain JSX. Do not add `.js` files outside dependencies or generated artifacts.
- Use TypeScript types for module contracts and runtime validation at important cross-boundary entry points.
- Give the Game Runtime exclusive write access to authoritative gameplay state.
- Communicate from React to the game through explicit commands.
- Communicate from the game to React through small, immutable UI snapshots or discrete events.
- Let the renderer consume render snapshots; never let it decide gameplay outcomes.
- Prepare and validate one immutable combat visual theme during loading, then inject it through the GameHost into rendering instead of importing mutable presentation globals.
- Keep Glyph Material and appearance identity orthogonal: Material owns gameplay／physical response, while an appearance profile selects semantic palette and brightness roles resolved by the prepared visual theme.
- Make creation, start, pause, reset, and disposal explicit lifecycle operations.

### MUST NOT

- Do not update React state every animation frame.
- Do not store enemies, bullets, Glyph arrays, or Pixi display objects in React state, context, reducers, or refs used as gameplay storage.
- Do not put the simulation loop in a React render path.
- Do not import React from `src/game/**`.
- Do not import PixiJS outside `src/game/rendering/**` or a narrowly scoped asset/bootstrap adapter.
- Do not import DOM APIs into gameplay core modules.
- Do not store authoritative gameplay state, damage rules, AI state, or authoritative positions on Pixi display objects.
- Do not read a Sprite/Particle position back into gameplay state.
- Do not embed species-, weapon-, drop-, effect-, obstacle-, or background-specific battle-canvas colors in gameplay definitions, render adapters, or React SCSS. Authoring `#RRGGBB` literals belong only to the centralized theme config; prepared numeric tints are derived data and must not be duplicated as hand-authored product colors.
- Do not create one expensive `Text` or `HTMLText` object per Glyph for large enemy bodies.
- Do not introduce a large ECS framework until measured requirements justify it.

## 4. Target directory layout

Create only the directories required by the current milestone, but preserve these ownership boundaries:

```text
src/
  app/                         React-only application shell
    components/                Reusable UI components
    screens/                   React-owned non-gameplay DOM screens
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
      runModifierSystem.ts
      volatileReactionSystem.ts
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
      modifiers/
      visuals/
        combatVisualTheme.ts  Types, validation, and prepared theme contract
        prototypeCombatVisualTheme.ts

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
  <ModifierRewardScreen /> visible only in PAUSED_MODIFIER
  <PauseMenu />
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
gameHost.selectModifier({
  offerId,
  choiceId,
})
gameHost.updateSettings(settings)
gameHost.dispose()

const unsubscribe = gameHost.subscribeUi((uiSnapshot) => {})
```

Rules:

- `subscribeUi` publishes only UI-sized data: phase, feature-defined HUD and end-of-run summaries, initial weapon choices, upgrade choices, Modifier choices with their Runtime-authored authorization origin, owned-Modifier summaries, equipped-weapon and Module-Slot summaries, target eligibility, boss summaries, and recoverable errors. Feature-specific fields belong to their detailed content contracts. React must not label a `RUN_START_TEST` offer as a defeated-Boss reward or infer the origin from timing.
- Do not include entity arrays, Glyph arrays, projectiles, particles, Pixi objects, or mutable WorldState references.
- Publish when relevant UI values change or on a low-frequency throttle. Do not publish at display refresh rate by default.
- React StrictMode may mount, clean up, and mount again. GameHost initialization and disposal must not leak a ticker, RAF, event listener, canvas, or asset subscription.
- React controls the initial-weapon, upgrade, and Modifier-reward DOM/UI, including cards, target／replacement previews where applicable, focus, and animation. Runtime controls whether simulation is paused, which choices and targets are legal, and whether a transaction commits.
- UI preview state may remain local to React, but the final command must include the active offer ID and every authoritative target ID needed for one atomic Runtime validation and commit.
- Modifier card presentation must agree with React's actual selected-choice state. A one-choice offer initializes its only choice as selected and enables Confirm immediately, but does not auto-submit. Any default-highlighted card must expose the same selected state, including accessible selection semantics; focus and hover remain visually distinct. A new offer clears stale local selection before establishing any valid default.

## 7. Game phases and lifecycle

Use an explicit phase/state machine rather than scattered booleans:

```text
BOOT → LOADING → READY → RUNNING
                    ↘ PAUSED_MODIFIER → RUNNING  [run-start test flag only]
RUNNING              ↔ PAUSED_MENU
                     → PAUSED_UPGRADE → RUNNING
                     → PAUSED_MODIFIER → PAUSED_MODIFIER, PAUSED_UPGRADE, or RUNNING
                     → DEATH_REVIEW → GAME_OVER → READY
any non-final phase   → DISPOSED
```

Required behavior:

- Asset/config failure stays in `LOADING` or transitions to a documented error state; it must not start a partial simulation.
- `READY` means initialization succeeded and the runtime is waiting for an explicit `startRun` command with a valid initial weapon from the frozen unlock set; fixed simulation steps have not started. With the run-start testing flag enabled, a valid command creates the WorldState and initial Weapon Instance, then enters one `RUN_START_TEST` Modifier offer before any fixed step instead of entering `RUNNING` immediately.
- `PAUSED_UPGRADE` stops fixed simulation steps completely for the whole decision chain: card preview, weapon target, optional Module-Slot or weapon replacement, authoritative commit, and any next queued offer.
- `PAUSED_MODIFIER` is a separate complete Gameplay pause for a Runtime-authorized Run Modifier offer. Production authorization comes from a defeated Boss Encounter; the only first-pass testing authorization is the validated run-start flag. The phase stops fixed simulation, Volatile waves, status progression, projectiles, enemies, drops, XP, and director work until an authoritative Modifier commit succeeds and any next queued decision is selected.
- Consecutive Modifier and XP-upgrade decisions must remain continuously paused. Only the final transition back to `RUNNING` after the run has already executed a `RUNNING` step grants the shared resume invulnerability once; moving directly from `PAUSED_MODIFIER` to `PAUSED_UPGRADE` must not grant it. `READY → PAUSED_MODIFIER → RUNNING` from the run-start testing offer is still the initial-start path and grants none.
- Menu pause stops gameplay time. Rendering may remain static or run at a deliberately reduced rate.
- `DEATH_REVIEW` may run only the narrow phase-specific scheduler defined by [`docs/content/player-survival.md`](docs/content/player-survival.md); it is neither ordinary `RUNNING` simulation nor a renderer-owned timer. The explicit result-entry command alone transitions it to `GAME_OVER`.
- Repeated `start`, `pause`, `resume`, and `dispose` calls must have defined idempotent behavior.
- Disposal removes DOM listeners, input listeners, ticker/RAF callbacks, subscriptions, scene nodes, and owned GPU resources.
- `COLLAPSING` is an individual creature lifecycle phase, not a global game phase. A collapsing creature no longer participates in targeting, damage, or collision. The runtime owns collapse timing and allows reward/cleanup only after the whole-body collapse and any already-authorized Runtime-owned Volatile source-event sequence for that creature／Encounter resolve, even if an explicit death rule hands its visual fragments to the renderer during that phase.

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

Re-check whether simulation may continue before every catch-up step, not only once at the start of an RAF callback. If any authoritative decision or death transition leaves `RUNNING`, including an XP upgrade or Boss Modifier reward, stop the remaining steps immediately and clear the accumulator state that must not cross the phase boundary. This is required for a genuinely complete pause.

Each fixed step runs systems in a stable order:

```text
Input sample
→ Movement
→ Spawn / Director
→ Targeting / Weapons
→ Projectile movement / Collision
→ Damage application / Glyph material response / Modifier status outcomes
→ Current Volatile reaction waves
→ Topology structural commit / Boss split / Creature collapse / Drops / XP
→ Decision arbitration: PLAYER_DIED > MODIFIER_REWARD > XP_UPGRADE
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

Derive independent Modifier-offer RNG domains from the run seed. At minimum, `BOSS_REWARD` and `RUN_START_TEST` are domain-separated so a testing offer never advances the production Boss stream. Combat, enemy, rendering, XP-upgrade, and test-offer RNG consumption must not change Boss Modifier offers for the same owned-Modifier and reward state. Stable content order and stable IDs remain the final tie-breaks.

Validate `enableRunStartModifierOfferForTesting` as a Boolean before entering `READY` and freeze it for the run. It is developer Runtime config, not a React setting, persisted player preference, query-string command, or mutable mid-run switch. When false it must create no authorization, offer, or RNG side effect.

### Tunable numeric source of truth

Every tunable production value has exactly one validated authoring source. Current values belong only to the relevant config／content module and enter gameplay through its immutable prepared representation. Product documents, architecture documents, comments, UI code, Runtime systems, render adapters, and tests must not copy a current production default as a second source of truth.

The first-pass authoring sources are:

- weapon combat profiles: the definition modules under `src/game/content/weapons/`;
- Weapon Module Rank payloads, spacing, and Damage Spread parameters: `src/game/content/upgrades/prototypeWeaponModules.ts`;
- level progression: `src/game/content/upgrades/levelProgression.ts`;
- Run Modifier parameters: `src/game/content/modifiers/prototypeRunModifiers.ts`;
- combat presentation values: `src/game/content/visuals/prototypeCombatVisualTheme.ts`;
- Runtime-only developer switches and loop／host settings: the validated config modules under `src/game/runtime/`.

Detailed content documents preserve parameter names, formulas, units, relative ordering, ownership, validation constraints, and behavioral invariants, and link directly to the authoring source. They do not list the current tunable default. When a formula needs a value, use the prepared field name symbolically rather than substituting today's number.

Production-content tests follow the same boundary:

- content wiring tests compare a registry entry with its canonical authoring／preparation function, or verify schema, validation, identity, and freezing; they do not maintain a second numeric snapshot;
- system and integration tests derive expected production behavior from the prepared definition, resolved profile, or prepared Rank payload used by that test world;
- an explicit numeric literal is allowed when it is a mathematical constant, an asserted non-tunable product invariant, or a test-local fixture whose test constructs the input definition and does not claim that the number is the production default;
- formula and validation tests may use deliberately chosen boundary fixtures, but their names and setup must make that isolation clear;
- changing one authoring default should require no behavior-test or document edit unless the semantic contract, formula, validation boundary, or a deliberately versioned balance-acceptance artifact also changes.

Do not add a scattered “balance snapshot” assertion merely to notice config edits. If a future release needs locked balance approval, introduce one explicit, versioned content-baseline artifact with clear ownership instead of duplicating values across ordinary unit tests.

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
- Determine the eligible ordinary-enemy definitions from content-defined progression before selecting a spawn definition. First appearances must preserve `Z → BO → BAT → ROCK → SNAKE`. Gameplay simulation time supplies each content-defined earliest gate, while a successful committed spawn of the previous species authorizes progression to the next; a failed candidate neither counts as an appearance nor permits a skip. Once introduced, definitions may join content-defined weighted pools. Do not use player kill count as the first-pass appearance gate or hard-code current time gates, weights, or speeds into the director.
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
  appearanceProfileId: GlyphAppearanceProfileId
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

This is a conceptual contract; `GlyphMaterialId`, `GlyphAppearanceProfileId`, and `GlyphCellState` are domain types whose concrete representation belongs to the Glyph model. Optimize storage after measurement. Encoded characters, enum values, and parallel typed arrays are acceptable as long as the logical fields and behavior remain intact. For high counts, prefer packed arrays, struct-of-arrays, or paged typed arrays over thousands of class instances.

Preserve the distinction between:

- anchor/local position: the body's intended shape;
- Body Motion offset/rotation: the deterministic, species-specific pose layered over the current anchor;
- offset/velocity: temporary deformation, knockback, scattering, and recovery;
- current/max durability: authoritative local life and its initial capacity;
- material: local durability／impulse／displacement／recovery／destruction behavior, not creature hue;
- appearance profile: the semantic species／role palette identity that survives damage, Husk state, morph, reassembly, and split ownership changes unless an explicit content rule replaces it;
- state: exactly the living progression `HEALTHY`, `DAMAGED`, or `HUSK` for active creature Glyphs;
- status flags and status-specific payload: orthogonal Runtime-owned negative／temporary rules such as `CRACKED` or a Slime disconnected latch; they do not add another life-state enum or a second HP model;
- render alpha/tint: presentation resolved from Glyph state, appearance profile, transient response state, and the prepared combat visual theme.

The state and durability invariants are:

```text
HEALTHY: currentDurability === maxDurability
DAMAGED: 0 < currentDurability < maxDurability
HUSK: currentDurability === 0
```

`currentDurability`, `maxDurability`, and damage amounts are finite non-negative gameplay numbers; current durability and damage may be fractional. Do not round damage to integers or impose a hidden minimum damage of `1`. Clamp subtraction to zero and use one documented precision normalization so tiny floating-point residues cannot prevent `HUSK` or collapse transitions. A Glyph with `maxDurability === 1` transitions directly from `HEALTHY` to `HUSK` only when an effective hit is at least its remaining durability; a smaller hit produces fractional `DAMAGED` durability. Do not create hidden durability merely to force a visible state step. A Husk cannot take durability damage, recover durability, or revive. While its creature is active, it must retain its stable Glyph ID, an authoritative owner ID, maximum durability, anchor/local position, deformation data, and gameplay outline footprint. Explicit body reassembly, morph, or validated Boss-split rules may update its anchor or owner without changing its identity or durability. It remains visible at the theme-defined low Husk tier so the creature silhouette does not shrink as it is consumed.

Boolean status presence may use typed bit flags, but multiplier, duration, stack, source-event identity, and reassembly-episode data require explicit status-specific payload. Do not allocate a generic per-Cell `Map<statusId, object>` or let systems manipulate raw bits directly. Status mutation belongs behind named Glyph／status-store APIs, follows stable Glyph identity across owner transfer, and resets completely on Husk transition when the status is living-only, cleanup, pool reuse, and new-run creation.

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
- Body Blueprint anchors／topology and Body Motion strategy are orthogonal. In particular, the vertical `O`-above-`B` BONE layout retains the existing BONE motion groups and per-instance phase variation; row／column arrangement must not implicitly select another motion behavior.
- Evaluate Body Motion during fixed simulation steps after root movement and structural layout. Ordinary `Z`, `BO`, `BAT`, `ROCK`, and `SNAKE` motion runs only while the owner is `ACTIVE`; other lifecycle phases require an explicit content rule.
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

1. Weapon emits one stable attack event with an ID, primary `DamageShape`, damage amount, impact parameters, an explicit authoritative frontier-traversal direction policy, its semantic `PlayerAttackVisualRoleId`, and an optional prepared `DamageSpreadProfile`. Traversal direction is not interchangeable with Material impulse or whole-body knockback direction. Values needed after contact are snapshotted and must survive projectile travel or delayed topology transfer.
2. Spatial index returns candidate outline Glyphs; entity-level collision may be used only as a broad phase.
3. A precise shape test produces the **Impact Cells**: every distinct `HEALTHY`, `DAMAGED`, or `HUSK` Cell intersecting the DamageShape.
4. If there are no Impact Cells, the attack misses. If there are Impact Cells, local hit flash, particles, material displacement, and other impact effects apply only to those Cells, regardless of their life state.
5. For each struck creature/body, select **Damage Targets** only from its living/damageable Cells. Prefer living Impact Cells first. For each remaining Husk source, form its authoritative forward ray and prefer the first living Cell whose authoritative Glyph Circle intersects that ray, ordered by first forward intersection, lateral deviation, topology distance, and stable Glyph ID. Only when no living Cell remains along that source ray may selection fall back to the nearest canonical-topology frontier. Directionally aligned candidates must not lose to a closer side Cell merely because the side Cell has a shorter topology distance. Neither ray traversal nor frontier fallback may cross an absent canonical edge between authored disconnected components merely because they share one owner; without an explicit cross-component policy, a fully Husk source component yields local impact feedback but no remote durability target.
6. A single-target/point attack has a quota of `1`. An area attack's per-body `targetQuota` equals the number of distinct outline Cells of that body in its Impact Cells. Each living Cell may be selected at most once by that attack; an unfilled quota is discarded rather than stacked repeatedly onto a surviving Cell.
7. If a spread profile exists, query exterior bands around the original whole DamageShape. Band width is a centralized validated content value; classify positive distance `d` with `(n - 1)w < d <= nw`. A Cone uses the exterior of the whole Cone, never one band per particle, sample, or Impact Cell.
8. Spread candidates may belong to any owner but must be living/damageable Cells. Never include a Husk, fill a spread quota through topology, or transfer spread damage to another Cell. Select every living Cell precisely intersecting a configured band.
9. Consolidate in-shape targets, spread candidates, and pending remote-direct reservations by `attackEventId` and stable Glyph ID before immediate mutation or scheduling. Each Cell may receive at most one durability change from that event, using the highest applicable amount; a reserved remote direct hit prevents a lower spread claim from applying early. All internal samples of one Cone share an event, while Projectile Count creates separate Cone events that may each damage an overlapping Cell once.
10. Apply primary local hit flash, particles, and Material response only to Impact Cells. Primary feedback continues to use the struck creature's own Appearance Profile. For every remote direct target, Runtime must reconstruct one deterministic canonical-topology path from its selected source Impact Cell, preferring forward progress and lower lateral deviation when equal-length paths exist. Store the path, reserved damage, target ID, source attack identity, presentation role, and Gameplay-time progress as authoritative pending-transfer state. Do not mutate the remote target's durability yet.
11. After the source's normal primary flash, advance a lower-emphasis pulse over each subsequent path Cell in source-to-target order. Intermediate path Cells receive no durability damage, Material impulse, primary hit particles, or whole-body knockback. Never represent the path with a straight／curved line or any segment drawn between Cells. Complete gameplay pauses freeze pending-transfer progress.
12. On the fixed step when the pulse reaches its target, revalidate that the owner remains in a damageable combat phase and that the stable target Cell is still living. If valid, apply the reserved durability damage, statistics, topology invalidation, and the target's damage-state／brightness response together on that step; before arrival the target must retain its previous durability, state, and brightness. If invalid, terminate the pending transfer without damage and without silently retargeting another Cell. Only this arrival-time commit may trigger Husk or whole-body collapse from the reserved hit.
13. A spread target receives explicit immediate spread feedback tinted from the source attack role's configured `accent`, not the creature's primary-impact tint and not one global spread tint. It does not inherit the primary impulse, local Material response, whole-body knockback, or Husk traversal unless content explicitly opts into the Area directional policy. Runtime records the source role only when spread damage is actually applied; a later successful spread hit refreshes the duration and replaces the remembered role in stable attack-processing order.
14. Clamp and normalize durability after every immediate or arrival-time subtraction. A Glyph whose durability reaches zero enters `HUSK`, keeps its gameplay outline footprint, and becomes immune to further durability damage.
15. When an affected owner has no living Glyphs, transition the creature to `COLLAPSING`; only after collapse resolution may death rewards and cleanup occur.

Immediate direct, topology-transfer arrival, Damage Spread, and Modifier secondary damage must converge on one Runtime-owned durability-application outcome before mutating a Glyph. That boundary preserves the root attack／reaction-chain identity, damage route, causal Weapon Instance, base direct damage, Modifier bonuses, resolved pre-overkill amount, actual Durability delta, and previous／next Glyph state. Only an actual `Living → HUSK` transition may authorize Volatile, topology invalidation, or collapse work. Do not duplicate these decisions in weapon, pending-transfer, status, or renderer code.

Run Modifier interaction, including the additive-from-base Crack／Disconnected formula, route eligibility, Overload threshold, same-owner Volatile topology, breadth-first waves, per-fixed-step processing budget, Slime latch, and status arming rules, is defined only in [`docs/content/run-modifiers.md`](docs/content/run-modifiers.md). Modifier acquisition changes the current run's world rules; a pending direct transfer evaluates active world Modifier rules when it actually arrives, while its weapon-authored reserved base damage remains snapshotted.

Primary quota selection must be local-first and topology-driven, never random or transferred to another owner. Damage Spread is the only explicit cross-owner secondary phase described here and remains spatial rather than topology-driven. Never implement damage by subtracting creature HP first, damaging every Glyph uniformly, reducing a whole creature container's alpha, or using render state as the hitbox source of truth.

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
- `GHOST`: easy dispersal, low resistance to displacement, strong reassembly behavior.
- `ANACONDA`: segment ownership, breakable connectivity, independent segment motion.

Materials belong to Glyph Cells, even when a creature definition supplies one default material for its whole body. A material must affect the hit Glyphs' durability or physical response; it cannot be only a renderer-wide effect. Appearance profiles are separate content references: do not clone an otherwise identical Material merely to give another species a different hue. Hit tint and brightness stay in the struck Glyph's appearance family, while Material continues to control its local physical response.

For every split operation, test these invariants:

```text
glyphCountBefore === glyphCountAfter
sumCurrentDurabilityBefore === sumCurrentDurabilityAfter
sumMaxDurabilityBefore === sumMaxDurabilityAfter
every original glyphId has exactly one new owner
no Glyph is copied or lost
no new combat durability is created
```

### Boss Run Modifier rewards

Read [`docs/content/run-modifiers.md`](docs/content/run-modifiers.md) before changing Boss reward timing, Modifier pools, Cell statuses, `PAUSED_MODIFIER`, or the related UI. A split Boss authorizes one reward at the Encounter level only after the shared Encounter formally reaches `DEFEATED`; child bodies never reward independently. Copy the reward token before Boss cleanup, keep XP reward separate, exclude already-owned Modifier definitions, and use a dedicated atomic selection transaction. Never route this reward through the XP `WEAPON | MODULE` offer type.

## 12. Weapon and upgrade rules

Read [`docs/content/weapon-system.md`](docs/content/weapon-system.md) before changing this area. It defines the detailed permanent-unlock boundary, run acquisition, mixed three-card offers, ordered Module Slots, Rank upgrades, overwrite behavior, atomic commands, replacement semantics, UI flow, and links to the validated authoring sources for current tuning values. Do not duplicate a conflicting version of those rules or current defaults in code comments, tests, or another document.

Run Modifiers are a separate Boss-reward domain. They do not occupy Module Slots, do not use `WEAPON | MODULE` XP choices, and do not inherit the XP offer's exactly-three-card invariant when only one or two unowned Modifier definitions remain.

Separate weapon concerns:

```text
TargetStrategy       nearest, cone, random, chain candidate, manual aim
AttackPattern        single, burst, spread, beam, orbit, chain
DamageShape          point, circle, capsule, line, cone
DamageSpreadProfile  disabled, exterior bands with per-band damage ratios
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

The current `maximumEquippedWeapons` value lives only in validated run／content configuration. Every first-pass Weapon Definition must explicitly declare a Module Slot count accepted by the shared Weapon Definition validator. Runtime, UI, documents, and tests must read or derive those prepared values instead of repeating current defaults. First-pass Modules occupy one Slot, and one Weapon Instance cannot hold the same Module in multiple Slots.

Module placement follows one deterministic transaction rule:

1. If the same Module exists below maximum Rank, increase that Slot by one Rank.
2. Otherwise, if an empty Slot exists, install Rank I into the first empty Slot.
3. Otherwise require an explicit Slot index, destroy only that Slot's previous Module, and install the new Module at Rank I.
4. A Weapon Instance whose matching Module is already at maximum Rank is not an eligible target for that card.

Weapon replacement is also atomic. Below the equipment limit, create a new empty Weapon Instance. At the limit, require an explicit replacement instance, preserve its equipment position, discard all of its Modules and instance-owned runtime state, and leave every other Weapon Instance unchanged. Independent in-flight attacks use their spawn-time resolved snapshot; instance-attached attacks need an explicit termination rule.

Every level-up offer contains exactly three unique choice references and a stable offer ID. Choices may be `WEAPON` or `MODULE`; weapon choices come only from the run's frozen unlock set. The first offer guarantees at least one eligible, unlocked, unequipped weapon. Use a dedicated seeded upgrade RNG and stable content ordering. Exact later weights are content parameters, not system constants.

Level progression uses validated content for `xpToNext(level)` and reward values. Add XP into the current-level remainder, repeatedly consume crossed thresholds, preserve overflow, and queue one upgrade decision per crossed level. Determine the first-weapon-card guarantee from the first generated offer sequence, not from an assumed player level. Boss／Elite rewards require explicit content values and must not accidentally inherit an ordinary-enemy fallback.

React selection previews do not mutate the run. Final install／acquire commands must revalidate the active offer, choice kind, instance IDs, Rank, empty/full Slot state, and replacement target. Invalid or stale commands consume nothing, change nothing, and keep gameplay paused. Successful validation commits all changes atomically before consuming the offer or resuming.

Every damaging attack defines a stable attack-event identity, a `DamageShape`, its geometric dimensions such as radius／length／angle, a damage amount, an explicit frontier-traversal direction policy, and an optional prepared `DamageSpreadProfile`. The primary shape intersects the full authoritative creature outline, including Husks. A point-like attack selects one living Damage Target from the struck body; area shapes derive each struck body's quota from the number of its distinct intersected outline Cells. In-shape living Cells are selected first. Each remaining Husk source first selects the first aligned living Cell along its attack ray, and falls back to the nearest topology frontier only after that ray has no living candidate. Primary DamageShape intersection and durability-target selection are separate from local visual effects: only actual in-shape Impact Cells receive primary effects. Remote direct hits become pending Runtime transfers and commit only when their path pulse arrives. Spread independently queries every living Glyph precisely within the configured exterior bands, including Cells owned by other creatures, and never traverses Husk by default. Entity-level collision may be used only as a broad phase before Glyph-level queries and precise shape or band tests.

Gameplay projectiles are the only projectile-like objects that participate in damage/collision. Visual particles are rendering-only and never cause damage.

- An assisted projectile snapshots its actual normalized velocity at contact as the traversal direction. Use the corrected impact trajectory, not merely its launch direction.
- The flamethrower's authoritative damage comes from fixed-step Cone DamageShape pulses. One Cone stream pulse is one attack event: all internal geometry samples share its deduplication scope, while additional Cone streams created by Projectile Count use independent event IDs. Each Husk Impact Cell forms its own local traversal ray from that stream's muzzle origin through the Cell; do not use one parallel center-axis direction for every Cell in the Cone. Its `.`, `*`, and related sparks use the configured fire-spectrum palette and only visualize that shape; changing their configured color or density must not change gameplay or spread.
- An orbiting ball that damages enemies is an instance-attached authoritative Circle AREA attack. Runtime owns its deterministic orbit phase, world position, collision radius, per-ball／owner contact episodes, pause behavior, and cleanup when its Weapon Instance disappears. New entry or re-entry is immediately eligible to hit; only uninterrupted overlap uses the prepared `rehitCooldownMs` minimum successful-hit interval. A broad- or precise-phase owner candidate does not commit that gate: Damage System must first confirm at least one Impact Cell, including a Husk Impact Cell that schedules a pending topology transfer. Collision uses relative previous-to-current motion for both the ball and moving owner so authoritative contact agrees with interpolated presentation. Traversal direction comes from the resolved ball motion to the actual contact point, including radial movement; this is distinct from outward whole-body knockback. Renderer-owned halo and trail particles do not collide.
- When a weapon explicitly applies whole-body knockback, Runtime displaces the creature root in an authoritative, bounded way so every active outline Glyph, including Husks, follows it. Local Material impulse and hit presentation remain restricted to actual Impact Cells; pending remote Damage Targets receive neither. Never reuse knockback direction as traversal direction unless the weapon contract explicitly makes them identical.

- Every fired gameplay projectile uses an explicit tracking profile.
- `ASSISTED` projectiles may make limited corrections toward their initial target, but permanently become ballistic after passing or losing that target. They must not reacquire or turn back.
- `HOMING` projectiles may use stronger steering, keep targets behind them, and reacquire through a budgeted spatial query after target loss.
- Target IDs, target validity, steering, and reacquisition are authoritative runtime concerns. The renderer only visualizes projectile positions.

Upgrade effects should produce explicit modifiers or strategy changes. Avoid scattered checks such as `if (hasUpgradeX)` across unrelated systems.

A universal Module must have a meaningful, validated interpretation for every weapon allowed to receive it. Damage Spread, primary DamageShape geometry, targeting／travel range, duration, projectile count, pierce, knockback, and element are separate capability axes; do not collapse them into ambiguous fields or silently offer no-op cards. Damage Spread adds living-only exterior bands and does not enlarge the primary shape. Compose Rank effects in a stable order and keep the fixed-step firing path free of per-step modifier allocations.

The confirmed Range Module follows pattern-specific contracts rather than mutating one shared `range` field:

- Assisted projectiles increase initial acquisition range, lock-maintenance range, and a separately authored maximum path-distance budget by the same complete Rank multiplier. Consume that budget from actual travelled distance, snapshot it at emission, preserve the final partial segment for collision, and do not use projectile lifetime as a disguised Range value.
- Pulsed Cone weapons multiply only the authoritative axial length from the muzzle origin. The damage event and rendering-only flame-emitter summary must receive the same resolved length; angle, muzzle distance, damage, cadence, particle count, and Damage Spread band data remain unchanged.
- Persistent orbit weapons keep the base orbit radius and separately authored contact-circle radius unchanged, and use the Rank multiplier only for the maximum radius of a deterministic outward radial sweep. Inner and outer contact boundaries are derived from orbit radius minus／plus contact radius; they are not separate fields. Tune symmetric contact forgiveness through the centralized contact radius, never by shifting the orbit radius. Angular spacing and radial phase offsets remain deterministic across multiple balls. Runtime must perform relative swept-circle collision using the previous and current authoritative ball and owner positions, place the DamageShape at the resolved contact point, and avoid treating a profile-revision position rebase as a long attack sweep.
- Attack Speed may advance the orbit's shared angular／radial phase more quickly, but it and Range never shorten the prepared `rehitCooldownMs` continuous-overlap throttle. Re-entry remains immediately eligible regardless of phase speed. Damage Spread continues to start at the actual resolved primary DamageShape exterior with unchanged prepared band width and ratios.
- Do not add Range to the eligible content pool until all confirmed first-three-weapon mappings, target-specific Runtime previews, and required collision behavior are implemented. React may display only immutable before／after summaries authored by Runtime; it must not calculate weapon-specific Range values.

New combat features must first define their Glyph interaction instead of modifying creature HP. For example, fire applies durability damage over time, freezing changes Glyph displacement/material response, corrosion damages and fades Glyphs, lightning selects adjacent Glyphs, and black holes attract and deform Glyphs.

## 13. PixiJS rendering rules

### Battlefield visual-theme contract

- `src/game/content/visuals/prototypeCombatVisualTheme.ts` is the one routinely tuned authoring source for battle-canvas base palettes, alpha, brightness-emphasis tiers, outlines, XP transition／flash timing values, and Run Modifier semantic presentation profiles. Every color field in this authoring config uses a `#RRGGBB` string; short hex, alpha-bearing hex, CSS color names, missing `#`, and non-hex characters are invalid. Alpha stays explicit beside the color instead of being packed into the string. `combatVisualTheme.ts` owns distinct authoring and prepared types, structural validation, one-time conversion, and the immutable prepared representation; neither file imports PixiJS or React. Material-, weapon-, and collapse-specific behavior durations remain with their owning validated content; Modifier `attack／hold／settle`, amplitude, duty-cycle, suppression-priority, overlay-character, fragment-brightness, and effect-density values belong to the theme's Modifier roles because they jointly define battlefield readability.
- The theme covers semantic roles for the player, every player-attack family, ordinary-enemy appearance profiles and their shared emphasis ladder, Elite／Boss tiers, XP and other drops, hit／spread／transfer effects, Run Modifier persistent／transient channels, Husk states, backgrounds, obstacles, and other battlefield elements. Base-palette hue／saturation／lightness and presentation brightness emphasis are separate concerns: sharing a tier must never force differently hued creatures toward the same pale tint. React-only menu／HUD styling remains a separate UI concern.
- Creature and weapon content selects stable appearance／effect role IDs. It does not contain color literals, and the renderer must not grow a species or weapon `switch`. During `LOADING`, `prepareGameContent()` strictly validates every authoring color string, converts each one exactly once into a 24-bit numeric tint, validates non-aesthetic structure and numeric ranges, and freezes the prepared theme into `PreparedGameContent`. The GameHost passes that same prepared theme to Runtime and rendering instead of creating a second copy. Fixed steps, per-Glyph resolution, render snapshots, and Pixi synchronization consume only prepared numeric tints and must never parse color strings.
- Do not reject a valid `#RRGGBB` authoring color because it violates a configured saturation／lightness bound, an inferred state-luminance order, or a cross-role brightness ceiling. Those are art-direction targets for browser visual tuning, not Runtime startup invariants. Structural role IDs, required non-empty palettes, alpha ranges, tier assignments, and non-color timing／gain relationships remain validated. Automated tests may verify conversion and structural behavior, but must not pin exact palette literals or prevent deliberate color experimentation.
- XP presentation age derives from simulation／gameplay presentation time. Occasional flashes are deterministically staggered by stable drop ID, consume no gameplay RNG, never synchronize the whole drop field, and freeze across any complete gameplay pause. Pickup radius, reward value, and collection timing are independent of presentation state.
- Render snapshots may carry semantic presentation roles plus the minimum simulation-time fields needed to resolve them, or already-resolved immutable presentation values. Whichever boundary is chosen, there is one resolution path and no second set of literals in adapters.

Recommended scene layers:

```text
stage
  worldRoot              render group where appropriate
    backgroundLayer
    dropLayer
    enemyGlyphLayer
    modifierStatusLayer  persistent bounded overlays such as CRACKED fragments
    modifierEffectLayer  short Runtime-authorized OVERLOAD／VOLATILE events
    projectileLayer
    effectLayer
  debugLayer
```

Rendering rules:

- Use PixiJS scene objects only inside the rendering layer.
- Use a shared glyph atlas. Prefer bitmap/MSDF glyph rendering for frequently changing or numerous text visuals.
- The first release uses a Printable ASCII glyph atlas. Expanding the required gameplay atlas to CJK or emoji is a separate product and performance decision.
- Glyph-based hostile attacks use a shared hostile-attack font bank prepared during `LOADING` and referenced by stable bank／frame IDs. Creature-specific Body fonts must not leak into attacks implicitly; emission and dissipation paths must reuse prepared atlas frames and pooled views rather than creating `Text` or runtime textures.
- Do not use `Text` or `HTMLText` for per-frame-updated high-volume Glyphs.
- `Text` is acceptable for small, static, or infrequently changed labels.
- `BitmapText` is suitable for frequently changing counters or longer text whose characters do not need independent gameplay ownership.
- For high-volume independent Glyph views, use atlas frames with pooled `Particle`/`Sprite` views according to required features.
- `ParticleContainer` is appropriate only when particles share a base texture and do not require per-particle filters, masks, events, or blend modes.
- Run Modifier visuals use bounded resolved channels: base appearance, persistent motion, persistent surface, transient deformation, and event overlay. Do not send an unbounded generic status list to PixiJS or let independent effects multiply scale, tint, displacement, and shake without a central priority／clamp resolver.
- Modifier motion uses short validated `attackDurationMs／holdDurationMs／settleDurationMs` profiles. Persistent instability is mostly still with deterministic low-duty-cycle micro-bursts; no Modifier uses wall-clock phase, endless sine shake, long blur／glow tails, or renderer load to alter authoritative timing.
- OVERLOAD compression requires independent `scaleX／scaleY` or an equivalent bounded directional-deformation contract in render snapshots; it must not mutate authoritative Glyph scale or collision. VOLATILE uses discrete resolved source pulses, never a radial ring or source-to-target line. DISCONNECTED render offsets remain small and never become canonical topology or hitbox input.
- Compile CRACKED fragment frames from the shared Printable ASCII atlas during loading and render them through a pooled layer sharing the same atlas source. Use two or three validated fragments per visible CRACKED Cell with deterministic pattern selection. Do not rasterize Text, generate textures, create Containers, or attach filters／masks per Cell at hit time. Consider a custom particle shader／batcher only after the pooled-fragment stress profile proves it necessary.
- Set only actually animated `dynamicProperties` on `ParticleContainer`. Any pooled layer whose tint or alpha changes by appearance state must enable and reset its color property explicitly.
- Synchronize authoritative Glyph rotation through the render snapshot when a motion profile uses it. Before enabling rotation uploads on a shared high-population layer, measure the cost; if it is material, partition rotating and non-rotating Glyph batches without creating per-creature containers or display objects.
- Set `boundsArea` when using `ParticleContainer`, especially with culling.
- Group similar object types, base textures, and blend modes to preserve batching.
- Use object pools for projectiles, Glyph fragments, damage particles, and short-lived effects.
- Reset every pooled view's semantic role, tint, alpha, presentation age, and flash phase before reuse; a recycled XP view must not inherit the prior drop's settled or flashing state.
- Runtime chooses every ordered topology-transfer path, pending-damage target, arrival commit, stable timing, and spread-feedback target, and retains the snapshotted source `PlayerAttackVisualRoleId` for active spread feedback. Render snapshots may carry only resolved per-Glyph transfer intensity／tint and already-committed target appearance, or the minimum immutable semantic roles needed by the shared theme resolver. The renderer may interpolate／fade those values but must never search Glyph topology, reconstruct a route, infer a weapon from entity IDs, choose or damage a target, reveal its post-damage brightness before Runtime arrival, or extend presentation lifetime.
- Render topology transfer by briefly brightening the actual path Cells in source-to-target order through the existing batched Glyph／effect paths where practical. Transfer emphasis must remain below the source Impact Cell's primary flash while staying visibly sequential; its tint, alpha, step interval, and duration belong to the centralized prepared visual theme. Do not draw a line, curve, beam, or other geometry between source and target, and do not create one `Text`, `Graphics`, or `Container` per participating Cell or per frame. Spread tint resolves from `playerAttacks[visualRoleId].accent`; shared spread-effect config may control alpha, scale, and timing but must not provide one weapon-agnostic tint.
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
- Range diagnostics when that Module is enabled: range-expired projectile count, active projectile path-distance budgets, orbit swept-collision candidates, and precise swept tests;
- topology-transfer diagnostics: active pending transfers, total retained path Cells, arrival commits, invalid-target cancellations, path／state pool misses, and path-search time;
- Run Modifier diagnostics: active definitions and authorization origins, Boss reward tokens, run-start-test authorization count, domain-separated offer-RNG use, Volatile active chains／current waves／next waves／active interval countdowns, resolved and deferred source events, maximum wave depth, scheduler pool misses, affected owners with deferred structural commits, DISCONNECTED topology-cache rebuild time, vulnerable component counts, active Crack／latch counts, Overload evaluations／successes, active／peak cracked-fragment particles, Modifier core／optional overlay counts, visual-budget suppressions, and status／effect pool misses;
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

`maxExplosionResolutionsPerFixedStep` is a frozen authoritative processing budget, not a hard Volatile-chain cap and not an adaptive renderer quality setting. `waveIntervalMs` is the separate frozen Gameplay simulation-time delay that begins only after one chain's current wave fully drains and controls promotion of its next breadth-first wave. Both come from validated config and remain fixed for the run; the current interval authoring value lives only in [`prototypeRunModifiers.ts`](src/game/content/modifiers/prototypeRunModifiers.ts), while its semantics live in [`run-modifiers.md`](docs/content/run-modifiers.md). Unprocessed explosion events and active interval countdowns remain queued or frozen across fixed steps and complete gameplay pauses; no event may be dropped, merged into a fake AoE, or applied early because PixiJS, particles, or pools are under pressure.

Directional topology paths are searched and frozen once when the hit schedules a pending transfer. Advancing active transfers must be `O(active transfers + path steps reached this fixed step)` and must not rerun owner-wide topology search every step. Reuse path/state storage where practical, but never drop, apply early, or duplicate reserved damage because a visual or pool budget is exhausted; quality degradation may remove only nonessential particles, not the ordered Cell pulse, target-arrival timing, or validation semantics.

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
preserves the time-gated first-appearance progression from Z to BO to BAT to ROCK to SNAKE
keeps O above B without changing the BONE motion profile or phase variation
converts every valid #RRGGBB authoring color exactly once during content preparation
rejects short hex, alpha-bearing hex, CSS names, missing #, and invalid hex characters before READY
accepts any valid #RRGGBB palette without aesthetic hue, saturation, lightness, or luminance rejection
publishes only prepared numeric tints to Runtime, render snapshots, and PixiJS
staggers XP flashes by stable drop ID and freezes their presentation age while paused
resets pooled XP presentation state before reuse
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
keeps fractional durability until accumulated damage reaches zero and normalizes floating-point residue
classifies spread bands from the original whole damage-shape exterior
damages every living glyph in a spread band across owners without damaging or traversing from husks
applies at most the highest direct or spread amount once per glyph and attack event
deduplicates all samples inside one cone but lets independent cone events overlap
emits spread feedback without inheriting the primary material impulse
colors spread feedback from each source attack role's accent without a renderer weapon switch
lets the latest successful spread hit deterministically replace the active feedback role and refresh its duration
prefers the first living Cell along a Husk impact's forward attack ray over a closer side frontier
falls back to the nearest topology frontier only after the forward direction is drilled through
does not jump a Husk impact across an absent canonical edge to another same-owner component
uses contact velocity for projectile traversal and swept motion rather than knockback direction for orbit traversal
uses one muzzle-to-impact traversal ray per Cone Husk source and deduplicates Area targets
pulses every Cell on a deterministic frontier-transfer path in source-to-target order without drawing a line
keeps topology-transfer pulse emphasis below the source Impact Cell's primary hit feedback
keeps a remote target's durability, state, and brightness unchanged until the pulse arrives
commits reserved frontier damage and target brightness together at arrival without duplicate damage
cancels an invalid pending target at arrival without silently retargeting
emits one centered assisted volley from one target query
lets separate centered cone streams apply independent overlap damage
keeps multiple orbit balls evenly phase-spaced after a Rank change
extends assisted acquisition and travelled path distance without changing projectile speed or radius
uses one resolved Cone length for authoritative damage and rendering-only flame presentation
keeps Damage Spread band width unchanged after Range extends the primary attack reach
sweeps an orbit ball between its base and maximum Range without enlarging its content-defined contact circle
detects Glyph contacts across the complete previous-to-current orbit sweep
hits immediately when an orbit ball enters or re-enters an owner contact episode
throttles uninterrupted orbit overlap per ball／owner at the prepared `rehitCooldownMs`
does not commit an orbit re-hit gate when a preliminary sweep candidate yields no Impact Cells
uses relative ball／owner swept motion so moving targets cannot cross the rendered contact without collision
publishes weapon-specific Range previews without letting React derive combat values
validates the run-start Modifier testing flag and produces no offer, authorization, or RNG side effect when it is false
creates one run-start test offer only after a valid initial Weapon and before the first fixed step when the flag is true
commits the run-start test offer through the normal Modifier transaction without consuming a Boss token, advancing the Boss RNG domain, or granting resume invulnerability
clears the test authorization and consumed guard on run teardown, then creates at most one fresh authorization for the next valid run
authorizes one Boss Modifier reward only after the Encounter reaches DEFEATED
offers three unique unowned Modifiers when possible, two when exactly two remain, and one normal explicitly confirmed choice when exactly one remains
keeps a default-highlighted Modifier card synchronized with the actual selected choice and enables Confirm without a redundant second click
rejects stale or duplicate Modifier commands without consuming the reward
keeps Modifier and queued XP decisions continuously paused and resumes only once
emits one Volatile explosion only for the first Living-to-Husk transition
advances Volatile in stable breadth-first waves without dropping deferred events
never resolves a chain's newly created next wave in the same fixed step
validates and freezes the Volatile wave interval, starts it only after the current wave fully drains, and waits the complete configured Gameplay time before promoting the next wave
keeps the Volatile processing budget frozen for the run and independent of Pixi load
defers only the affected living owner's Slime structural commit while its Volatile chain can still deal damage
classifies Disconnected from Living canonical components regardless of deformation distance
protects every component at or above the prepared `protectedComponentRatio` of the largest component
applies Disconnected only to actual direct targets, including transfer arrival targets
carries the higher Disconnected multiplier through one Slime reassembly episode
applies no damage when Overload adds Crack
prevents one root attack event, including delayed transfers, from consuming its newly created Crack
composes Disconnected and Crack additively from base direct damage rather than multiplying their prepared multipliers
lets Spread and Volatile Husk transitions continue Volatile without inheriting other Modifier bonuses
keeps Disconnected presentation mostly still, severity-driven, pause-frozen, and independent of authoritative Glyph positions
presents Overload as one directional compression／radial event and Cracked as bounded pooled atlas fragments without per-Cell filters or runtime textures
presents every resolved Volatile source as a discrete core topology pulse with same-wave simultaneity and cross-wave order
resolves simultaneous Modifier visuals through bounded channels and fully resets pooled fragment／effect state on reuse
```

## 18. AI implementation workflow

Before changing code:

1. Read the relevant section of `spec.md`.
2. For player health, shields, incoming player damage, player death, run results, or game-over／return-to-menu work, read `docs/content/player-survival.md` completely.
3. For weapon, loadout, Module, upgrade-card, or replacement work, read `docs/content/weapon-system.md` completely.
4. For Run Modifier, Boss Modifier reward, Cell status, Modifier damage composition, `PAUSED_MODIFIER`, or related UI work, read `docs/content/run-modifiers.md` completely.
5. Inspect nearby code and the current repository structure.
6. Identify the owning layer and verify dependency direction.
7. State assumptions only when the spec and relevant content document are silent.
8. Prefer the smallest vertical slice that proves the architecture.

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
- Are pause, reset, and disposal correct?
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
- weapons beyond the confirmed first three, permanent unlock conditions, Module Rank tables beyond the confirmed Attack Speed／Projectile Count／Damage Spread／Range／Knockback prototype tables, offer weights, element coexistence rules, weapon evolution gates, and any ability that changes the equipment limit or preserves investments during replacement.
- same-name Run Modifier Rank／stack／replacement rules, zero-eligible Modifier reward fallback, cross-owner Volatile geometry, future DISCONNECTED bridge／core criteria, and any Boss Modifier reward cadence that departs from the confirmed one-reward-per-`DEFEATED`-Encounter contract.

Use a conservative temporary default only when it is easy to reverse, and record it next to the relevant contract.
