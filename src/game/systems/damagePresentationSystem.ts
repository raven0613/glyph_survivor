import type { WorldState } from '../runtime/worldState.ts'

export function runDamagePresentationSystem(
  world: WorldState,
  deltaMs: number,
): void {
  for (let index = world.damageTransferLinks.length - 1; index >= 0; index -= 1) {
    const link = world.damageTransferLinks[index]
    link.remainingMs = Math.max(0, link.remainingMs - deltaMs)
    if (link.remainingMs > 0) {
      continue
    }
    world.damageTransferLinks.splice(index, 1)
    world.damageTransferLinkPool.push(link)
  }
}
