import {
  CREATURE_SPLIT_BEHAVIOR,
  type CreatureDefinition,
} from '../content/creatures/creatureDefinition.ts'
import { getCreatureDefinition } from '../content/gameContent.ts'
import { getGlyphWorldX, getGlyphWorldY } from '../glyph/glyphPosition.ts'
import { GLYPH_CELL_STATE, type GlyphCell } from '../glyph/glyphStore.ts'
import type { EnemyState } from '../runtime/worldEntities.ts'
import {
  spawnSplitEnemy,
  type WorldState,
} from '../runtime/worldState.ts'
import {
  compileSlimeBodyLayout,
  findLivingConnectedComponents,
} from './slimeTopology.ts'
import {
  getDisconnectedTopologySnapshot,
  invalidateDisconnectedTopologyOwner,
} from './disconnectedTopologySystem.ts'
import { GLYPH_STATUS_FLAG, hasGlyphStatus } from '../glyph/glyphStatus.ts'
import { hasPendingVolatileSourcesForOwner } from '../runtime/volatileState.ts'

interface Component {
  readonly cells: readonly GlyphCell[]
  readonly centroidX: number
  readonly centroidY: number
  readonly minimumGlyphId: number
}

interface BodyTarget extends Component {
  readonly assignedCells: GlyphCell[]
  readonly coreGlyphIds: ReadonlySet<number>
}

function createComponent(enemy: EnemyState, cells: readonly GlyphCell[]): Component {
  const total = cells.reduce(
    (position, cell) => ({
      x: position.x + getGlyphWorldX(enemy.x, cell),
      y: position.y + getGlyphWorldY(enemy.y, cell),
    }),
    { x: 0, y: 0 },
  )
  return {
    cells,
    centroidX: total.x / cells.length,
    centroidY: total.y / cells.length,
    minimumGlyphId: Math.min(...cells.map((cell) => cell.id)),
  }
}

function compareComponents(first: Component, second: Component): number {
  return (
    second.cells.length - first.cells.length ||
    first.minimumGlyphId - second.minimumGlyphId
  )
}

function findNearestTarget(
  x: number,
  y: number,
  targets: readonly BodyTarget[],
): BodyTarget {
  return [...targets].sort((first, second) => {
    const firstDistance =
      (first.centroidX - x) ** 2 + (first.centroidY - y) ** 2
    const secondDistance =
      (second.centroidX - x) ** 2 + (second.centroidY - y) ** 2
    return (
      firstDistance - secondDistance ||
      first.minimumGlyphId - second.minimumGlyphId
    )
  })[0]
}

function assignCellsToTargets(
  enemy: EnemyState,
  ownerGlyphs: readonly GlyphCell[],
  components: readonly Component[],
  minimumIndependentCellCount: number,
): BodyTarget[] {
  const qualifying = components
    .filter((component) => component.cells.length >= minimumIndependentCellCount)
    .sort(compareComponents)
  const selected = qualifying.length > 0 ? qualifying : [components[0]]
  const targets: BodyTarget[] = selected.map((component) => ({
    ...component,
    assignedCells: [...component.cells],
    coreGlyphIds: new Set(component.cells.map((glyph) => glyph.id)),
  }))
  const selectedMinimumIds = new Set(
    selected.map((component) => component.minimumGlyphId),
  )

  for (const component of components) {
    if (selectedMinimumIds.has(component.minimumGlyphId)) {
      continue
    }
    findNearestTarget(component.centroidX, component.centroidY, targets)
      .assignedCells.push(...component.cells)
  }

  for (const glyph of ownerGlyphs) {
    if (glyph.state !== GLYPH_CELL_STATE.HUSK) {
      continue
    }
    const target = findNearestTarget(
      getGlyphWorldX(enemy.x, glyph),
      getGlyphWorldY(enemy.y, glyph),
      targets,
    )
    target.assignedCells.push(glyph)
  }
  return targets
}

function commitTargetLayout(
  world: WorldState,
  owner: EnemyState,
  target: BodyTarget,
  originalWorldPositions: ReadonlyMap<number, readonly [number, number]>,
  reassemblyEpisodeId: number,
): void {
  const layout = compileSlimeBodyLayout(
    target.assignedCells,
    target.coreGlyphIds,
  )
  for (const glyph of target.assignedCells) {
    world.glyphStore.transferGlyph(glyph.id, owner.id)
  }

  owner.x = target.centroidX
  owner.y = target.centroidY
  owner.previousX = target.centroidX
  owner.previousY = target.centroidY
  owner.velocityX = 0
  owner.velocityY = 0
  owner.behaviorElapsedMs = 0
  owner.layoutMode = 'COMPILED'
  owner.phase = 'REASSEMBLING'
  owner.reassemblyEpisodeId = reassemblyEpisodeId

  for (const anchor of layout.anchors) {
    const position = originalWorldPositions.get(anchor.glyphId)
    if (!position) {
      throw new Error(`Missing pre-split position for Glyph ${anchor.glyphId}.`)
    }
    world.glyphStore.setGlyphCompiledLayout(
      anchor.glyphId,
      anchor.topologyX,
      anchor.topologyY,
      anchor.localX,
      anchor.localY,
      position[0] - owner.x - anchor.localX,
      position[1] - owner.y - anchor.localY,
    )
    world.glyphStore.setGlyphPresentation(
      anchor.glyphId,
      anchor.isEye ? 'EYE' : 'BODY',
    )
  }
  invalidateDisconnectedTopologyOwner(world, owner.id)
}

function beginDisconnectedReassemblyEpisode(
  world: WorldState,
  ownerGlyphs: readonly GlyphCell[],
  ownerId: number,
): number {
  if (!world.runModifierState.resolvedProfile.disconnected) {
    return 0
  }
  const snapshot = getDisconnectedTopologySnapshot(world, ownerId)
  if (!snapshot) {
    return 0
  }
  const episodeId = world.disconnectedState.nextReassemblyEpisodeId
  world.disconnectedState.nextReassemblyEpisodeId += 1
  for (const glyph of ownerGlyphs) {
    if (
      hasGlyphStatus(glyph, GLYPH_STATUS_FLAG.DISCONNECTED_LATCHED)
    ) {
      world.glyphStore.applyDisconnectedLatch(
        glyph.id,
        glyph.disconnectedLatchedMultiplier,
        episodeId,
      )
    }
  }
  for (const component of snapshot.components) {
    if (component.isProtected) {
      continue
    }
    for (const glyphId of component.glyphIds) {
      world.glyphStore.applyDisconnectedLatch(
        glyphId,
        component.multiplier,
        episodeId,
      )
    }
  }
  return episodeId
}

function resolveSlimeOwner(
  world: WorldState,
  enemy: EnemyState,
  definition: CreatureDefinition,
): void {
  const ownerGlyphs = [...world.glyphStore.getOwnerGlyphs(enemy.id)]
  const livingComponents = findLivingConnectedComponents(ownerGlyphs)
  if (livingComponents.length <= 1) {
    return
  }

  const components = livingComponents
    .map((cells) => createComponent(enemy, cells))
    .sort(compareComponents)
  const minimumIndependentCellCount = Math.ceil(
    enemy.splitReferenceCellCount * definition.minimumIndependentCellRatio,
  )
  const targets = assignCellsToTargets(
    enemy,
    ownerGlyphs,
    components,
    minimumIndependentCellCount,
  )
  const reassemblyEpisodeId = beginDisconnectedReassemblyEpisode(
    world,
    ownerGlyphs,
    enemy.id,
  )
  const originalWorldPositions = new Map(
    ownerGlyphs.map(
      (glyph) =>
        [
          glyph.id,
          [
            getGlyphWorldX(enemy.x, glyph),
            getGlyphWorldY(enemy.y, glyph),
          ] as const,
        ] as const,
    ),
  )

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]
    const owner =
      index === 0
        ? enemy
        : spawnSplitEnemy(world, enemy, target.centroidX, target.centroidY)
    commitTargetLayout(
      world,
      owner,
      target,
      originalWorldPositions,
      reassemblyEpisodeId,
    )
  }
}

export function runSlimeSplitSystem(world: WorldState): void {
  const dirtyOwnerIds = [...world.topologyDirtyOwnerIds].sort(
    (first, second) => first - second,
  )
  let deferredOwnerCount = 0

  for (const ownerId of dirtyOwnerIds) {
    const enemy = world.enemyById.get(ownerId)
    if (!enemy || enemy.phase === 'DEAD') {
      world.topologyDirtyOwnerIds.delete(ownerId)
      continue
    }
    const definition = getCreatureDefinition(world.content, enemy.definitionId)
    if (definition.splitBehaviorId !== CREATURE_SPLIT_BEHAVIOR.SLIME_TOPOLOGY) {
      world.topologyDirtyOwnerIds.delete(ownerId)
      continue
    }
    const ownerDurability = world.glyphStore.getOwnerDurability(ownerId)
    if (
      (ownerDurability?.livingGlyphCount ?? 0) > 0 &&
      hasPendingVolatileSourcesForOwner(world.volatileState, ownerId)
    ) {
      deferredOwnerCount += 1
      continue
    }
    world.topologyDirtyOwnerIds.delete(ownerId)
    resolveSlimeOwner(world, enemy, definition)
  }
  world.diagnostics.volatileStructuralDeferredOwnerCount = deferredOwnerCount
}
