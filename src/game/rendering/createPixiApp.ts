import { Application } from 'pixi.js'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'

function createAbortError(): Error {
  const error = new Error('Game initialization was aborted.')
  error.name = 'AbortError'
  return error
}

export async function createPixiApp(
  canvas: HTMLCanvasElement,
  visualTheme: CombatVisualTheme,
  signal?: AbortSignal,
): Promise<Application> {
  if (signal?.aborted) {
    throw createAbortError()
  }

  const application = new Application()
  await application.init({
    canvas,
    resizeTo: canvas.parentElement ?? window,
    autoStart: false,
    sharedTicker: false,
    resolution: 1,
    autoDensity: true,
    antialias: false,
    background: visualTheme.map.canvasBackground.tint,
    backgroundAlpha: visualTheme.map.canvasBackground.alpha,
    powerPreference: 'high-performance',
    gcActive: true,
  })

  if (signal?.aborted) {
    application.destroy({ removeView: false, releaseGlobalResources: true })
    throw createAbortError()
  }

  return application
}
