import type { RenderSnapshot } from './renderSnapshot.ts'

/** Releases references to every view owned by the completed run. */
export function clearRenderSnapshot(snapshot: RenderSnapshot): void {
  snapshot.cameraX = 0
  snapshot.cameraY = 0
  snapshot.viewportWidth = 1
  snapshot.viewportHeight = 1
  snapshot.playerX = 0
  snapshot.playerY = 0
  snapshot.enemies.length = 0
  snapshot.effects.length = 0
  snapshot.projectiles.length = 0
  snapshot.orbits.length = 0
  snapshot.drops.length = 0
  snapshot.flameEmitters.length = 0
  snapshot.damageTransferLinks.length = 0
}
