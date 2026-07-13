import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import {
  createWorldState,
  spawnEnemy,
  spawnProjectile,
} from '../../src/game/runtime/worldState.ts'
import {
  compileSlimeBodyLayout,
  findLivingConnectedComponents,
} from '../../src/game/systems/slimeTopology.ts'
import { runSlimeSplitSystem } from '../../src/game/systems/slimeSplitSystem.ts'
import { runGlyphMaterialSystem } from '../../src/game/systems/glyphMaterialSystem.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'
import { ASSISTED_PROJECTILE_TRACKING } from '../../src/game/content/weapons/projectileTracking.ts'
import { runEnemySpatialIndexSystem } from '../../src/game/systems/enemySpatialIndexSystem.ts'
import { runCollisionSystem } from '../../src/game/systems/collisionSystem.ts'
import { runDamageSystem } from '../../src/game/systems/damageSystem.ts'

function getEncounterTotals(
  world: ReturnType<typeof createWorldState>,
  encounterId: number,
) {
  const encounterGlyphs = world.glyphStore.cells.filter((glyph) => {
    const owner = world.enemyById.get(glyph.ownerId)
    return owner?.encounterId === encounterId
  })

  return {
    glyphIds: encounterGlyphs.map((glyph) => glyph.id).sort((a, b) => a - b),
    currentDurability: encounterGlyphs.reduce(
      (total, glyph) => total + glyph.currentDurability,
      0,
    ),
    maxDurability: encounterGlyphs.reduce(
      (total, glyph) => total + glyph.maxDurability,
      0,
    ),
  }
}

test('uses four-direction topology and treats diagonal cells as disconnected', () => {
  const components = findLivingConnectedComponents([
    { id: 1, state: GLYPH_CELL_STATE.HEALTHY, topologyX: 0, topologyY: 0 },
    { id: 2, state: GLYPH_CELL_STATE.HEALTHY, topologyX: 1, topologyY: 1 },
    { id: 3, state: GLYPH_CELL_STATE.HUSK, topologyX: 0, topologyY: 1 },
  ])

  assert.deepEqual(
    components.map((component) => component.map((cell) => cell.id)),
    [[1], [2]],
  )
})

test('compiles a deterministic compact layout without changing glyph identity', () => {
  const cells = Array.from({ length: 15 }, (_, index) => ({
    id: index + 10,
    state: GLYPH_CELL_STATE.HEALTHY,
    topologyX: index % 5,
    topologyY: Math.floor(index / 5),
  }))

  const first = compileSlimeBodyLayout(cells)
  const second = compileSlimeBodyLayout([...cells].reverse())

  assert.deepEqual(first, second)
  assert.deepEqual(
    first.anchors.map((anchor) => anchor.glyphId).sort((a, b) => a - b),
    cells.map((cell) => cell.id),
  )
  assert.equal(first.anchors.filter((anchor) => anchor.isEye).length, 2)
})

test('packs living cells into one component while keeping Husk identities', () => {
  const cells = Array.from({ length: 18 }, (_, index) => ({
    id: index + 1,
    state:
      index % 3 === 1
        ? GLYPH_CELL_STATE.HUSK
        : GLYPH_CELL_STATE.HEALTHY,
    topologyX: index % 6,
    topologyY: Math.floor(index / 6),
  }))

  const layout = compileSlimeBodyLayout(cells)
  const stateById = new Map(cells.map((cell) => [cell.id, cell.state]))
  const compiledCells = layout.anchors.map((anchor) => ({
    id: anchor.glyphId,
    state: stateById.get(anchor.glyphId)!,
    topologyX: anchor.topologyX,
    topologyY: anchor.topologyY,
  }))

  assert.equal(findLivingConnectedComponents(compiledCells).length, 1)
  assert.deepEqual(
    compiledCells.map((cell) => cell.id).sort((a, b) => a - b),
    cells.map((cell) => cell.id),
  )
})

test('selects reassembly eyes only from the primary component', () => {
  const cells = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    state: GLYPH_CELL_STATE.HEALTHY,
    topologyX: index,
    topologyY: 0,
  }))
  const primaryGlyphIds = new Set([10, 11, 12])

  const layout = compileSlimeBodyLayout(cells, primaryGlyphIds)

  assert.equal(
    layout.anchors
      .filter((anchor) => anchor.isEye)
      .every((anchor) => primaryGlyphIds.has(anchor.glyphId)),
    true,
  )
})

test('splits two qualifying components while preserving every glyph and durability', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-split', 800, 600, content)
  const root = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  root.phase = 'ACTIVE'
  assert.ok(root.encounterId)

  for (const glyph of world.glyphStore.getOwnerGlyphs(root.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(root.id)
  const before = getEncounterTotals(world, root.encounterId)
  const worldPositionsBefore = new Map(
    world.glyphStore.cells.map((glyph) => [
      glyph.id,
      {
        x: root.x + glyph.localX + glyph.offsetX,
        y: root.y + glyph.localY + glyph.offsetY,
      },
    ]),
  )

  runSlimeSplitSystem(world)

  const bodies = world.enemies.filter(
    (enemy) => enemy.encounterId === root.encounterId,
  )
  const after = getEncounterTotals(world, root.encounterId)
  assert.equal(bodies.length, 2)
  assert.equal(bodies.some((enemy) => enemy.id === root.id), true)
  assert.equal(
    bodies.every((enemy) => enemy.phase === 'REASSEMBLING'),
    true,
  )
  assert.deepEqual(after, before)
  for (const glyph of world.glyphStore.cells) {
    const owner = world.enemyById.get(glyph.ownerId)
    const previous = worldPositionsBefore.get(glyph.id)
    assert.ok(owner)
    assert.ok(previous)
    assert.ok(
      Math.abs(owner.x + glyph.localX + glyph.offsetX - previous.x) < 0.0001,
    )
    assert.ok(
      Math.abs(owner.y + glyph.localY + glyph.offsetY - previous.y) < 0.0001,
    )
  }
  assert.equal(
    new Set(world.glyphStore.cells.map((glyph) => glyph.id)).size,
    world.glyphStore.cells.length,
  )
})

test('keeps a single body when disconnected components are below the fixed threshold', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-reassemble', 800, 600, content)
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'

  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    if (glyph.topologyX !== 2 && glyph.topologyX !== 11) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(slime.id)

  runSlimeSplitSystem(world)

  assert.equal(
    world.enemies.filter((enemy) => enemy.encounterId === slime.encounterId)
      .length,
    1,
  )
  assert.equal(slime.phase, 'REASSEMBLING')
  assert.equal(
    findLivingConnectedComponents(
      world.glyphStore.getOwnerGlyphs(slime.id),
    ).length,
    1,
  )
})

test('reassembles an original three-cell edge fragment into its primary body', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-three-cell-fragment', 800, 600, content)
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  const fragmentGlyphIds = new Set(
    world.glyphStore
      .getOwnerGlyphs(slime.id)
      .filter(
        (glyph) =>
          (glyph.topologyY === 2 && glyph.topologyX <= 1) ||
          (glyph.topologyY === 3 && glyph.topologyX === 1),
      )
      .map((glyph) => glyph.id),
  )

  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    if (
      glyph.topologyX === 2 &&
      (glyph.topologyY === 2 || glyph.topologyY === 3)
    ) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(slime.id)

  runSlimeSplitSystem(world)

  assert.equal(fragmentGlyphIds.size, 3)
  assert.equal(
    world.enemies.filter((enemy) => enemy.encounterId === slime.encounterId)
      .length,
    1,
  )
  assert.equal(
    findLivingConnectedComponents(
      world.glyphStore.getOwnerGlyphs(slime.id),
    ).length,
    1,
  )
  assert.equal(
    world.glyphStore
      .getOwnerGlyphs(slime.id)
      .filter((glyph) => fragmentGlyphIds.has(glyph.id))
      .every((glyph) => glyph.role === 'BODY'),
    true,
  )

  for (let step = 0; step < 360; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
    runMovementSystem(world, 1_000 / 60)
  }
  assert.equal(slime.phase, 'ACTIVE')
  assert.equal(
    world.glyphStore
      .getOwnerGlyphs(slime.id)
      .filter((glyph) => fragmentGlyphIds.has(glyph.id))
      .every((glyph) => Math.hypot(glyph.offsetX, glyph.offsetY) <= 1),
    true,
  )
})

test('does not merge an established child owner after it falls below fifteen cells', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-independent-child', 800, 600, content)
  const root = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  root.phase = 'ACTIVE'
  for (const glyph of world.glyphStore.getOwnerGlyphs(root.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(root.id)
  runSlimeSplitSystem(world)
  const child = world.enemies.find(
    (enemy) => enemy.encounterId === root.encounterId && enemy.id !== root.id,
  )
  assert.ok(child)
  const childComponents = findLivingConnectedComponents(
    world.glyphStore.getOwnerGlyphs(child.id),
  )
  const retainedGlyphIds = new Set(
    childComponents.sort((first, second) => second.length - first.length)[0]
      .slice(0, 10)
      .map((glyph) => glyph.id),
  )
  for (const glyph of world.glyphStore.getOwnerGlyphs(child.id)) {
    if (
      glyph.currentDurability > 0 &&
      !retainedGlyphIds.has(glyph.id)
    ) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(child.id)
  const ownerIdsBefore = world.enemies
    .filter((enemy) => enemy.encounterId === root.encounterId)
    .map((enemy) => enemy.id)
    .sort((a, b) => a - b)

  runSlimeSplitSystem(world)

  assert.deepEqual(
    world.enemies
      .filter((enemy) => enemy.encounterId === root.encounterId)
      .map((enemy) => enemy.id)
      .sort((a, b) => a - b),
    ownerIdsBefore,
  )
  assert.equal(
    world.glyphStore
      .getOwnerGlyphs(child.id)
      .filter((glyph) => glyph.currentDurability > 0)
      .every((glyph) => glyph.ownerId === child.id),
    true,
  )
})

test('pauses root movement while reassembling and resumes after cells settle', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-phase', 800, 600, content)
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(slime.id)
  runSlimeSplitSystem(world)
  const splitBodies = world.enemies.filter(
    (enemy) => enemy.encounterId === slime.encounterId,
  )
  const committedX = slime.x

  runMovementSystem(world, 100)
  assert.equal(slime.x, committedX)

  for (let step = 0; step < 360; step += 1) {
    runGlyphMaterialSystem(world, 1_000 / 60)
    runMovementSystem(world, 1_000 / 60)
  }

  assert.equal(
    splitBodies.every((enemy) => enemy.phase === 'ACTIVE'),
    true,
  )
})

test('keeps a far reassembling glyph inside authoritative broad-phase collision', () => {
  const content = prepareGameContent()
  const world = createWorldState('slime-reassembly-collision', 800, 600, content)
  const slime = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  slime.phase = 'ACTIVE'
  for (const glyph of world.glyphStore.getOwnerGlyphs(slime.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(slime.id)
  runSlimeSplitSystem(world)

  const glyph = world.glyphStore.cells
    .filter((candidate) => candidate.currentDurability > 0)
    .sort(
      (first, second) =>
        Math.hypot(second.offsetX, second.offsetY) -
        Math.hypot(first.offsetX, first.offsetY),
    )[0]
  const owner = world.enemyById.get(glyph.ownerId)
  assert.ok(owner)
  const durabilityBefore = glyph.currentDurability
  spawnProjectile(
    world,
    owner.x + glyph.localX + glyph.offsetX,
    owner.y + glyph.localY + glyph.offsetY,
    1,
    0,
    ASSISTED_PROJECTILE_TRACKING,
    owner.id,
  )

  runEnemySpatialIndexSystem(world)
  runCollisionSystem(world)
  runDamageSystem(world)

  assert.equal(glyph.currentDurability, durabilityBefore - 1)
})
