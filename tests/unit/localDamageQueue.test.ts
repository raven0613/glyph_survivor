import assert from 'node:assert/strict'
import test from 'node:test'
import { PLAYER_ATTACK_VISUAL_ROLE } from '../../src/game/content/visuals/combatVisualTheme.ts'
import {
  DAMAGE_FRONTIER_TRAVERSAL,
  createGlyphDamageQueue,
  type GlyphDamageEvent,
} from '../../src/game/glyph/localDamage.ts'

function createEvent(
  frontierTraversal: GlyphDamageEvent['frontierTraversal'],
): GlyphDamageEvent {
  return {
    attackEventId: 1,
    sourceWeaponInstanceId: 1,
    visualRoleId: PLAYER_ATTACK_VISUAL_ROLE.ASSISTED_PROJECTILE,
    primaryScope: 'LOCKED_OWNER',
    ownerId: 1,
    shapeKind: 'CIRCLE',
    shapeX: 0,
    shapeY: 0,
    shapeRadius: 4,
    shapeDirectionX: 0,
    shapeDirectionY: 0,
    shapeRange: 0,
    shapeHalfAngleRadians: 0,
    targetMode: 'SINGLE',
    amount: 1,
    impactStrengthMultiplier: 1,
    impactDirectionX: 1,
    impactDirectionY: 0,
    frontierTraversal,
  }
}

test('rejects a fixed frontier traversal without a usable direction', () => {
  const queue = createGlyphDamageQueue()

  assert.throws(
    () =>
      queue.enqueue(
        createEvent({
          kind: DAMAGE_FRONTIER_TRAVERSAL.FIXED_DIRECTION,
          directionX: 0,
          directionY: 0,
        }),
      ),
    /frontier traversal direction/i,
  )
})

test('snapshots a shape-origin frontier traversal policy', () => {
  const queue = createGlyphDamageQueue()
  queue.enqueue(
    createEvent({ kind: DAMAGE_FRONTIER_TRAVERSAL.FROM_SHAPE_ORIGIN }),
  )
  let captured: Readonly<GlyphDamageEvent> | undefined

  queue.drain((event) => {
    captured = event
  })

  assert.deepEqual(captured?.frontierTraversal, {
    kind: DAMAGE_FRONTIER_TRAVERSAL.FROM_SHAPE_ORIGIN,
  })
})
