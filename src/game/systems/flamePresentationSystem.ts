import type { WorldState } from '../runtime/worldState.ts'

export function runFlamePresentationSystem(
  world: WorldState,
  deltaMs: number,
): void {
  let writeIndex = 0
  for (const emitter of world.flameEmitters) {
    emitter.remainingMs -= deltaMs
    if (emitter.remainingMs <= 0) {
      world.flameEmitterPool.push(emitter)
      continue
    }
    world.flameEmitters[writeIndex] = emitter
    writeIndex += 1
  }
  world.flameEmitters.length = writeIndex
}
