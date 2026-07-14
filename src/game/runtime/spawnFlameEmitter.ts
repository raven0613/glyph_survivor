import type { ConeWeaponCombatProfile } from '../content/weapons/weaponDefinition.ts'
import type { FlameEmitterState } from './worldEntities.ts'
import type { WorldState } from './worldState.ts'

const MAX_ACTIVE_FLAME_EMITTERS = 8
const MAX_PARTICLES_PER_FLAME_EMITTER = 16

export function spawnFlameEmitter(
  world: WorldState,
  sourceWeaponInstanceId: number,
  attackSequence: number,
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  profile: Readonly<ConeWeaponCombatProfile>,
): FlameEmitterState {
  const recycled =
    world.flameEmitters.length >= MAX_ACTIVE_FLAME_EMITTERS
      ? world.flameEmitters.shift()
      : world.flameEmitterPool.pop()
  if (!recycled) {
    world.diagnostics.flameEmitterPoolMisses += 1
  }
  const emitter = recycled ?? ({} as FlameEmitterState)
  const presentation = profile.flamePresentation
  Object.assign(emitter, {
    id: world.nextFlameEmitterId,
    sourceWeaponInstanceId,
    x,
    y,
    directionX,
    directionY,
    range: profile.damageShape.range,
    fullAngleRadians: profile.damageShape.fullAngleRadians,
    durationMs: presentation.durationMs,
    remainingMs: presentation.durationMs,
    particleCount: Math.min(
      presentation.particleCount,
      MAX_PARTICLES_PER_FLAME_EMITTER,
    ),
    innerTint: presentation.innerTint,
    outerTint: presentation.outerTint,
    seed: Math.imul(sourceWeaponInstanceId, 65_537) + attackSequence,
  })
  world.nextFlameEmitterId += 1
  world.flameEmitters.push(emitter)
  return emitter
}
