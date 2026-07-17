import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createRenderSnapshot,
  writeRenderSnapshot,
} from '../../src/game/bridge/renderSnapshot.ts'
import {
  getCreatureDefinition,
  prepareGameContent,
} from '../../src/game/content/gameContent.ts'
import { CREATURE_BODY_MOTION_BEHAVIOR } from '../../src/game/content/creatures/creatureDefinition.ts'
import { BASIC_PROJECTILE_WEAPON_ID } from '../../src/game/content/weapons/basicProjectileWeapon.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../../src/game/glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE } from '../../src/game/glyph/glyphStore.ts'
import { createWorldState, spawnEnemy } from '../../src/game/runtime/worldState.ts'
import { runCreatureBodyMotionBehavior } from '../../src/game/systems/creatureBodyMotionStrategies.ts'
import { runMovementSystem } from '../../src/game/systems/movementSystem.ts'

function spawnActiveOrdinaryEnemy(definitionId: string) {
  const content = prepareGameContent()
  const world = createWorldState(
    `motion-${definitionId}`,
    800,
    600,
    content,
    BASIC_PROJECTILE_WEAPON_ID,
  )
  const definition = getCreatureDefinition(content, definitionId)
  const enemy = spawnEnemy(
    world,
    world.player.x - 200,
    world.player.y,
    0,
    definition,
  )
  enemy.phase = 'ACTIVE'
  enemy.bodyMotionPhaseOffset = 0
  return { world, definition, enemy }
}

function readRockMatrix(
  glyphs: ReturnType<typeof spawnActiveOrdinaryEnemy>['world']['glyphStore']['cells'],
): readonly [string, string] {
  const ordered = [...glyphs].sort((left, right) => {
    const leftY = left.localY + left.bodyMotionOffsetY
    const rightY = right.localY + right.bodyMotionOffsetY
    if (Math.abs(leftY - rightY) > 0.000_001) {
      return leftY - rightY
    }
    return (
      left.localX +
      left.bodyMotionOffsetX -
      (right.localX + right.bodyMotionOffsetX)
    )
  })
  return [
    ordered.slice(0, 2).map((glyph) => glyph.character).join(''),
    ordered.slice(2).map((glyph) => glyph.character).join(''),
  ]
}

function readHorizontalCharacters(
  glyphs: ReturnType<typeof spawnActiveOrdinaryEnemy>['world']['glyphStore']['cells'],
): string {
  return [...glyphs]
    .sort(
      (left, right) =>
        left.localX +
        left.bodyMotionOffsetX -
        (right.localX + right.bodyMotionOffsetX),
    )
    .map((glyph) => glyph.character)
    .join('')
}

function readSnakePositions(
  glyphs: ReturnType<typeof spawnActiveOrdinaryEnemy>['world']['glyphStore']['cells'],
): readonly (readonly [number, number])[] {
  return glyphs.map((glyph) => [
    glyph.localX + glyph.bodyMotionOffsetX,
    glyph.localY + glyph.bodyMotionOffsetY,
  ])
}

test('moves BAT wing cells on a crisp offset beat while keeping B restrained', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  const [bGlyph, aGlyph, tGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 45)

  assert.ok(Math.abs(aGlyph.bodyMotionOffsetY) > 0)
  assert.ok(Math.abs(tGlyph.bodyMotionOffsetY) > 0)
  assert.notEqual(aGlyph.bodyMotionOffsetY, tGlyph.bodyMotionOffsetY)
  assert.ok(
    Math.abs(bGlyph.bodyMotionOffsetY) < Math.abs(aGlyph.bodyMotionOffsetY),
  )
  assert.equal(aGlyph.bodyMotionOffsetX, 0)
  assert.equal(tGlyph.bodyMotionOffsetX, 0)
})

test('keeps an active BAT husk on its authored wing motion track', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  const [, aGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)
  world.glyphStore.applyDamage(aGlyph.id, aGlyph.currentDurability)

  runMovementSystem(world, 45)

  assert.equal(aGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(Number.isFinite(aGlyph.bodyMotionOffsetY), true)
  assert.notEqual(aGlyph.bodyMotionOffsetY, 0)
})

test('rattles BO cells independently and returns them to neutral when stopped', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.bone')
  const [bGlyph, oGlyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 55)

  assert.notDeepEqual(
    [bGlyph.bodyMotionOffsetX, bGlyph.bodyMotionOffsetY, bGlyph.rotation],
    [oGlyph.bodyMotionOffsetX, oGlyph.bodyMotionOffsetY, oGlyph.rotation],
  )
  assert.ok(Math.abs(bGlyph.rotation) + Math.abs(oGlyph.rotation) > 0)

  world.player.x = enemy.x
  world.player.y = enemy.y
  runMovementSystem(world, 1_000 / 60)

  assert.deepEqual(
    [
      bGlyph.bodyMotionOffsetX,
      bGlyph.bodyMotionOffsetY,
      bGlyph.rotation,
      oGlyph.bodyMotionOffsetX,
      oGlyph.bodyMotionOffsetY,
      oGlyph.rotation,
    ],
    [0, 0, 0, 0, 0, 0],
  )
})

test('keeps the Z bottom pivot stable while its authoritative center rocks', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.zombie')
  const [glyph] = world.glyphStore.getOwnerGlyphs(enemy.id)

  runMovementSystem(world, 120)

  assert.notEqual(glyph.rotation, 0)
  assert.notEqual(glyph.bodyMotionOffsetX, 0)
  const pivotLength = glyph.bodyMotionOffsetX / Math.sin(glyph.rotation)
  assert.ok(pivotLength > 0)
  assert.ok(
    Math.abs(
      glyph.bodyMotionOffsetY -
        pivotLength * (1 - Math.cos(glyph.rotation)),
    ) < 0.000_001,
  )
  assert.equal(
    getGlyphWorldX(enemy.x, glyph),
    enemy.x + glyph.localX + glyph.bodyMotionOffsetX + glyph.offsetX,
  )
  assert.equal(
    getGlyphWorldY(enemy.y, glyph),
    enemy.y + glyph.localY + glyph.bodyMotionOffsetY + glyph.offsetY,
  )
})

test('publishes authoritative glyph rotation through the render snapshot', () => {
  const { world, enemy } = spawnActiveOrdinaryEnemy('enemy.zombie')
  const [glyph] = world.glyphStore.getOwnerGlyphs(enemy.id)
  runMovementSystem(world, 120)
  const snapshot = createRenderSnapshot()

  writeRenderSnapshot(world, snapshot, 1)

  const renderGlyph = snapshot.enemies.find((candidate) => candidate.id === glyph.id)
  assert.ok(renderGlyph)
  assert.equal(renderGlyph.rotation, glyph.rotation)
})

test('recomputes body motion from phase without accumulating drift', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.bat')
  enemy.behaviorElapsedMs = 90
  runCreatureBodyMotionBehavior(world, enemy, definition)
  const firstPose = world.glyphStore
    .getOwnerGlyphs(enemy.id)
    .map((glyph) => [
      glyph.bodyMotionOffsetX,
      glyph.bodyMotionOffsetY,
      glyph.rotation,
    ])

  runCreatureBodyMotionBehavior(world, enemy, definition)

  assert.deepEqual(
    world.glyphStore
      .getOwnerGlyphs(enemy.id)
      .map((glyph) => [
        glyph.bodyMotionOffsetX,
        glyph.bodyMotionOffsetY,
        glyph.rotation,
      ]),
    firstPose,
  )
})

test('places stable ROCK glyphs at the four exact clockwise roll poses', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.rock')
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const identityBefore = glyphs.map((glyph) => ({
    id: glyph.id,
    character: glyph.character,
    currentDurability: glyph.currentDurability,
    maxDurability: glyph.maxDurability,
    topologyX: glyph.topologyX,
    topologyY: glyph.topologyY,
  }))
  const expectedMatrices = [
    ['RO', 'CK'],
    ['CR', 'KO'],
    ['KC', 'OR'],
    ['OK', 'RC'],
  ] as const

  for (let poseIndex = 0; poseIndex < expectedMatrices.length; poseIndex += 1) {
    enemy.bodyMotionProgress = poseIndex / expectedMatrices.length
    runCreatureBodyMotionBehavior(world, enemy, definition, 0)
    assert.deepEqual(readRockMatrix(glyphs), expectedMatrices[poseIndex])
  }

  assert.deepEqual(
    glyphs.map((glyph) => ({
      id: glyph.id,
      character: glyph.character,
      currentDurability: glyph.currentDurability,
      maxDurability: glyph.maxDurability,
      topologyX: glyph.topologyX,
      topologyY: glyph.topologyY,
    })),
    identityBefore,
  )
})

test('reverses ROCK roll from its current pose without jumping', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.rock')
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  enemy.bodyMotionProgress = 0.08
  enemy.velocityX = definition.maximumSpeed
  enemy.velocityY = 0
  runCreatureBodyMotionBehavior(world, enemy, definition, 40)
  const clockwisePose = glyphs.map((glyph) => [
    glyph.bodyMotionOffsetX,
    glyph.bodyMotionOffsetY,
  ])

  enemy.velocityX = -definition.maximumSpeed
  runCreatureBodyMotionBehavior(world, enemy, definition, 40)

  assert.ok(Math.abs(enemy.bodyMotionProgress - 0.08) < 0.000_001)
  assert.notDeepEqual(
    glyphs.map((glyph) => [glyph.bodyMotionOffsetX, glyph.bodyMotionOffsetY]),
    clockwisePose,
  )
})

test('times ROCK turning separately from the pause after each quarter turn', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.rock')
  assert.equal(
    definition.bodyMotion.behaviorId,
    'ROCK_ROLL',
  )
  if (definition.bodyMotion.behaviorId !== 'ROCK_ROLL') {
    assert.fail('ROCK must use its dedicated roll profile.')
  }
  enemy.velocityX = definition.maximumSpeed
  enemy.velocityY = 0

  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.fullRollDurationMs / 4,
  )

  assert.ok(Math.abs(enemy.bodyMotionProgress - 0.25) < 0.000_001)
  assert.equal(
    enemy.bodyMotionHoldRemainingMs,
    definition.bodyMotion.poseHoldDurationMs,
  )
  assert.deepEqual(
    readRockMatrix(world.glyphStore.getOwnerGlyphs(enemy.id)),
    ['CR', 'KO'],
  )

  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.poseHoldDurationMs,
  )

  assert.ok(Math.abs(enemy.bodyMotionProgress - 0.25) < 0.000_001)
  assert.equal(enemy.bodyMotionHoldRemainingMs, 0)

  runCreatureBodyMotionBehavior(world, enemy, definition, 1)

  assert.ok(enemy.bodyMotionProgress > 0.25)
})

test('settles ROCK to the nearest legal pose inside the direction dead zone', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.rock')
  if (definition.bodyMotion.behaviorId !== 'ROCK_ROLL') {
    assert.fail('ROCK must use its dedicated roll profile.')
  }
  enemy.bodyMotionProgress = 0.13
  enemy.velocityX = 0
  enemy.velocityY = definition.maximumSpeed

  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.fullRollDurationMs,
  )

  assert.ok(Math.abs(enemy.bodyMotionProgress - 0.25) < 0.000_001)
  assert.deepEqual(
    readRockMatrix(world.glyphStore.getOwnerGlyphs(enemy.id)),
    ['CR', 'KO'],
  )
})

test('keeps an active ROCK husk on the rigid roll track', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.rock')
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const rGlyph = glyphs.find((glyph) => glyph.character === 'R')
  assert.ok(rGlyph)
  world.glyphStore.applyDamage(rGlyph.id, rGlyph.currentDurability)
  enemy.bodyMotionProgress = 0.25

  runCreatureBodyMotionBehavior(world, enemy, definition, 0)

  assert.equal(rGlyph.state, GLYPH_CELL_STATE.HUSK)
  assert.deepEqual(readRockMatrix(glyphs), ['CR', 'KO'])
})

test('counts ROCK body motion once per owner and once per outline glyph', () => {
  const { world } = spawnActiveOrdinaryEnemy('enemy.rock')

  runMovementSystem(world, 1_000 / 60)

  assert.equal(world.diagnostics.bodyMotionEvaluationCount, 1)
  assert.equal(world.diagnostics.bodyMotionGlyphUpdateCount, 4)
  assert.equal(Number.isFinite(world.diagnostics.bodyMotionSimulationTimeMs), true)
  assert.ok(world.diagnostics.bodyMotionSimulationTimeMs >= 0)
})

test('turns SNAKE continuously into EKANS without changing head or glyph identity', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.snake')
  if (
    definition.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const identityBefore = glyphs.map((glyph) => ({
    id: glyph.id,
    character: glyph.character,
    bodySlotId: glyph.bodySlotId,
    topologyX: glyph.topologyX,
    topologyY: glyph.topologyY,
  }))

  runCreatureBodyMotionBehavior(world, enemy, definition, 0)
  assert.equal(readHorizontalCharacters(glyphs), 'SNAKE')

  enemy.velocityX = definition.maximumSpeed
  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.turnDurationMs / 2,
  )
  const halfwayPose = readSnakePositions(glyphs)
  assert.notEqual(readHorizontalCharacters(glyphs), 'EKANS')

  enemy.velocityX = -definition.maximumSpeed
  runCreatureBodyMotionBehavior(world, enemy, definition, 0)
  assert.deepEqual(readSnakePositions(glyphs), halfwayPose)

  enemy.velocityX = definition.maximumSpeed
  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.turnDurationMs / 2,
  )

  assert.equal(readHorizontalCharacters(glyphs), 'EKANS')
  assert.deepEqual(
    glyphs.map((glyph) => ({
      id: glyph.id,
      character: glyph.character,
      bodySlotId: glyph.bodySlotId,
      topologyX: glyph.topologyX,
      topologyY: glyph.topologyY,
    })),
    identityBefore,
  )
  assert.equal(glyphs[0].character, 'S')
})

test('squeezes SNA and E together while lifting only the stable K glyph', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.snake')
  if (
    definition.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const [sGlyph, nGlyph, aGlyph, kGlyph, eGlyph] = glyphs
  enemy.velocityX = -definition.maximumSpeed
  enemy.bodyMotionProgress = definition.bodyMotion.squeezePeakRatio

  runCreatureBodyMotionBehavior(world, enemy, definition, 0)

  assert.deepEqual(
    [sGlyph, nGlyph, aGlyph].map((glyph) => glyph.bodyMotionOffsetX),
    [
      definition.bodyMotion.snaCompressionDistance,
      definition.bodyMotion.snaCompressionDistance,
      definition.bodyMotion.snaCompressionDistance,
    ],
  )
  assert.equal(kGlyph.bodyMotionOffsetX, 0)
  assert.equal(
    eGlyph.bodyMotionOffsetX,
    -definition.bodyMotion.eCompressionDistance,
  )
  assert.deepEqual(
    glyphs.map((glyph) => glyph.bodyMotionOffsetY),
    [0, 0, 0, -definition.bodyMotion.kLiftDistance, 0],
  )
  assert.ok(
    aGlyph.localX + aGlyph.bodyMotionOffsetX <
      kGlyph.localX + kGlyph.bodyMotionOffsetX,
  )
  assert.ok(
    kGlyph.localX + kGlyph.bodyMotionOffsetX <
      eGlyph.localX + eGlyph.bodyMotionOffsetX,
  )

  enemy.velocityX = 0
  enemy.velocityY = 0
  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.cycleDurationMs,
  )

  assert.equal(readHorizontalCharacters(glyphs), 'SNAKE')
  assert.deepEqual(
    glyphs.map((glyph) => [
      glyph.bodyMotionOffsetX,
      glyph.bodyMotionOffsetY,
      glyph.rotation,
    ]),
    glyphs.map(() => [0, 0, 0]),
  )
})

test('mirrors the SNAKE squeeze while keeping K as the lifted glyph', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.snake')
  if (
    definition.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  enemy.velocityX = definition.maximumSpeed
  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.turnDurationMs,
  )
  const neutralRightFacingPositions = readSnakePositions(glyphs)

  enemy.bodyMotionProgress = definition.bodyMotion.squeezePeakRatio
  runCreatureBodyMotionBehavior(world, enemy, definition, 0)

  const squeezedRightFacingPositions = readSnakePositions(glyphs)
  const positionDeltas = squeezedRightFacingPositions.map(
    ([x, y], index) =>
      [
        x - neutralRightFacingPositions[index][0],
        y - neutralRightFacingPositions[index][1],
      ] as const,
  )
  assert.deepEqual(
    positionDeltas,
    [
      [-definition.bodyMotion.snaCompressionDistance, 0],
      [-definition.bodyMotion.snaCompressionDistance, 0],
      [-definition.bodyMotion.snaCompressionDistance, 0],
      [0, -definition.bodyMotion.kLiftDistance],
      [definition.bodyMotion.eCompressionDistance, 0],
    ],
  )
  assert.equal(readHorizontalCharacters(glyphs), 'EKANS')
})

test('counts SNAKE body motion once per owner and once per stable glyph', () => {
  const { world } = spawnActiveOrdinaryEnemy('enemy.snake')

  runMovementSystem(world, 1_000 / 60)

  assert.equal(world.diagnostics.bodyMotionEvaluationCount, 1)
  assert.equal(world.diagnostics.bodyMotionGlyphUpdateCount, 5)
})

test('preserves SNAKE facing in the horizontal dead zone and moves its Husk', () => {
  const { world, definition, enemy } = spawnActiveOrdinaryEnemy('enemy.snake')
  if (
    definition.bodyMotion.behaviorId !==
    CREATURE_BODY_MOTION_BEHAVIOR.SNAKE_SQUEEZE
  ) {
    assert.fail('SNAKE must use its dedicated squeeze profile.')
  }
  const glyphs = world.glyphStore.getOwnerGlyphs(enemy.id)
  const head = glyphs[0]
  world.glyphStore.applyDamage(head.id, head.currentDurability)
  enemy.velocityX = definition.maximumSpeed
  runCreatureBodyMotionBehavior(
    world,
    enemy,
    definition,
    definition.bodyMotion.turnDurationMs,
  )
  const rightFacingHeadPosition = [
    head.localX + head.bodyMotionOffsetX,
    head.localY + head.bodyMotionOffsetY,
  ]

  enemy.velocityX = 0
  enemy.velocityY = definition.maximumSpeed
  runCreatureBodyMotionBehavior(world, enemy, definition, 1_000 / 60)

  assert.equal(head.state, GLYPH_CELL_STATE.HUSK)
  assert.equal(readHorizontalCharacters(glyphs), 'EKANS')
  assert.deepEqual(
    [
      head.localX + head.bodyMotionOffsetX,
      head.localY + head.bodyMotionOffsetY,
    ],
    rightFacingHeadPosition,
  )
})
