import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCreatureDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import {
  createWorldState,
  spawnEnemy,
} from '../../src/game/runtime/worldState.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'

test('reports current animated creatures and Glyphs separately from cumulative work', () => {
  const content = prepareGameContent()
  const world = createWorldState(
    'body-motion-step-diagnostics',
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const rock = spawnEnemy(
    world,
    world.player.x - 100,
    world.player.y,
    0,
    getCreatureDefinition(content, 'enemy.rock'),
  )
  const snake = spawnEnemy(
    world,
    world.player.x + 100,
    world.player.y,
    0,
    getCreatureDefinition(content, 'enemy.snake'),
  )
  rock.phase = 'ACTIVE'
  snake.phase = 'ACTIVE'

  runMovementSystem(world, 1_000 / 60)

  assert.equal(world.diagnostics.bodyMotionActiveCreatureCount, 2)
  assert.equal(world.diagnostics.bodyMotionActiveGlyphCount, 9)
  assert.equal(world.diagnostics.bodyMotionEvaluationCount, 2)
  assert.equal(world.diagnostics.bodyMotionGlyphUpdateCount, 9)
  assert.equal(Number.isFinite(world.diagnostics.bodyMotionStepTimeMs), true)
  assert.ok(world.diagnostics.bodyMotionStepTimeMs >= 0)

  rock.phase = 'COLLAPSING'
  snake.phase = 'COLLAPSING'
  runMovementSystem(world, 1_000 / 60)

  assert.equal(world.diagnostics.bodyMotionActiveCreatureCount, 0)
  assert.equal(world.diagnostics.bodyMotionActiveGlyphCount, 0)
  assert.equal(world.diagnostics.bodyMotionEvaluationCount, 2)
  assert.equal(world.diagnostics.bodyMotionGlyphUpdateCount, 9)
})
