import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareGameContent } from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runDeathSystem } from '../../src/game/systems/deathSystem.ts'
import { runDropSystem } from '../../src/game/systems/dropSystem.ts'
import { runSlimeSplitSystem } from '../../src/game/systems/slimeSplitSystem.ts'

function createSplitEncounter() {
  const content = prepareGameContent()
  const world = createWorldState(
    'slime-encounter-death',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const root = spawnEnemy(world, 2_000, 2_000, 0, content.slimeBossDefinition)
  root.phase = 'ACTIVE'

  for (const glyph of world.glyphStore.getOwnerGlyphs(root.id)) {
    if (glyph.topologyX === 6 || glyph.topologyX === 7) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  world.topologyDirtyOwnerIds.add(root.id)
  runSlimeSplitSystem(world)
  return { world, root }
}

test('keeps the encounter active when only one split body is fully husked', () => {
  const { world, root } = createSplitEncounter()
  const child = world.enemies.find(
    (enemy) => enemy.encounterId === root.encounterId && enemy.id !== root.id,
  )
  assert.ok(child)

  for (const glyph of world.glyphStore.getOwnerGlyphs(child.id)) {
    if (glyph.currentDurability > 0) {
      world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
    }
  }
  runDeathSystem(world)
  runDropSystem(world)

  assert.equal(world.bossEncounters.get(root.encounterId!)?.phase, 'ACTIVE')
  assert.equal(child.phase, 'INACTIVE')
  assert.equal(world.drops.length, 0)
})

test('collapses the encounter before emitting one reward after all glyphs are husks', () => {
  const { world, root } = createSplitEncounter()

  for (const enemy of world.enemies) {
    if (enemy.encounterId !== root.encounterId) {
      continue
    }
    for (const glyph of world.glyphStore.getOwnerGlyphs(enemy.id)) {
      if (glyph.currentDurability > 0) {
        world.glyphStore.applyDamage(glyph.id, glyph.currentDurability)
      }
    }
  }
  runDeathSystem(world)
  runDropSystem(world)

  const encounter = world.bossEncounters.get(root.encounterId!)
  assert.ok(encounter)
  assert.equal(encounter.phase, 'COLLAPSING')
  assert.equal(
    world.enemies
      .filter((enemy) => enemy.encounterId === root.encounterId)
      .every((enemy) => enemy.phase === 'COLLAPSING'),
    true,
  )
  assert.equal(world.drops.length, 0)

  runDeathSystem(world, encounter.collapseDurationMs)
  runDropSystem(world)
  runDropSystem(world)

  assert.equal(encounter.phase, 'DEFEATED')
  assert.equal(
    world.enemies
      .filter((enemy) => enemy.encounterId === root.encounterId)
      .every((enemy) => enemy.phase === 'DEAD'),
    true,
  )
  assert.equal(world.drops.length, 1)
})
