import { calculateCameraView } from '../runtime/cameraTransform.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { PlayerSurvivalPresentationEventKind } from '../runtime/playerSurvivalPresentation.ts'
import type { WorldState } from '../runtime/worldState.ts'

export interface RenderPlayerSurvivalPresentation {
  currentShieldLayers: number
  eventRevision: number
  eventKind: PlayerSurvivalPresentationEventKind | null
  eventElapsedMs: number
  eventSeed: number
}

export interface RenderPlayerState {
  cameraX: number
  cameraY: number
  viewportWidth: number
  viewportHeight: number
  playerX: number
  playerY: number
  readonly playerSurvivalPresentation: RenderPlayerSurvivalPresentation
}

export function createRenderPlayerState(): RenderPlayerState {
  const centerX = GAME_CONFIG.worldWidth / 2
  const centerY = GAME_CONFIG.worldHeight / 2
  return {
    cameraX: centerX,
    cameraY: centerY,
    viewportWidth: 1,
    viewportHeight: 1,
    playerX: centerX,
    playerY: centerY,
    playerSurvivalPresentation: {
      currentShieldLayers: 0,
      eventRevision: 0,
      eventKind: null,
      eventElapsedMs: 0,
      eventSeed: 0,
    },
  }
}

function interpolate(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha
}

export function writeRenderPlayerState(
  world: Readonly<WorldState>,
  snapshot: RenderPlayerState,
  interpolationAlpha: number,
): ReturnType<typeof calculateCameraView> {
  const playerX = interpolate(
    world.player.previousX,
    world.player.x,
    interpolationAlpha,
  )
  const playerY = interpolate(
    world.player.previousY,
    world.player.y,
    interpolationAlpha,
  )
  const presentation = world.player.survivalPresentation
  snapshot.cameraX = playerX
  snapshot.cameraY = playerY
  snapshot.viewportWidth = world.viewportWidth
  snapshot.viewportHeight = world.viewportHeight
  snapshot.playerX = playerX
  snapshot.playerY = playerY
  snapshot.playerSurvivalPresentation.currentShieldLayers =
    world.player.survival.currentShieldLayers
  snapshot.playerSurvivalPresentation.eventRevision =
    presentation.eventRevision
  snapshot.playerSurvivalPresentation.eventKind = presentation.eventKind
  snapshot.playerSurvivalPresentation.eventElapsedMs = Math.max(
    0,
    world.runTimeMs - presentation.eventStartedAtMs,
  )
  snapshot.playerSurvivalPresentation.eventSeed = presentation.eventSeed
  return calculateCameraView(
    playerX,
    playerY,
    world.viewportWidth,
    world.viewportHeight,
  )
}

export function clearRenderPlayerState(snapshot: RenderPlayerState): void {
  snapshot.cameraX = 0
  snapshot.cameraY = 0
  snapshot.viewportWidth = 1
  snapshot.viewportHeight = 1
  snapshot.playerX = 0
  snapshot.playerY = 0
  snapshot.playerSurvivalPresentation.currentShieldLayers = 0
  snapshot.playerSurvivalPresentation.eventRevision = 0
  snapshot.playerSurvivalPresentation.eventKind = null
  snapshot.playerSurvivalPresentation.eventElapsedMs = 0
  snapshot.playerSurvivalPresentation.eventSeed = 0
}
