import type { InputState } from '../runtime/worldEntities.ts'
import { hasPointerPositionChanged } from './pointerMovement.ts'

export interface ViewportSize {
  readonly width: number
  readonly height: number
}

export interface InputAdapter {
  sample(target: InputState): void
  dispose(): void
}

const MOVEMENT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD'])
const POINTER_AIM_UPDATE_DISTANCE = 0.5

export function createInputAdapter(
  canvas: HTMLCanvasElement,
  getViewportSize: () => ViewportSize,
): InputAdapter {
  const pressedKeys = new Set<string>()
  let pointerScreenX = 0
  let pointerScreenY = 0
  let hasPointer = false
  let pointerRevision = 0

  function handleKeyDown(event: KeyboardEvent): void {
    if (MOVEMENT_KEYS.has(event.code)) {
      pressedKeys.add(event.code)
      event.preventDefault()
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    pressedKeys.delete(event.code)
  }

  function handlePointerMove(event: PointerEvent): void {
    const rectangle = canvas.getBoundingClientRect()
    const viewport = getViewportSize()

    if (rectangle.width <= 0 || rectangle.height <= 0) {
      return
    }

    const nextPointerScreenX =
      ((event.clientX - rectangle.left) / rectangle.width) * viewport.width
    const nextPointerScreenY =
      ((event.clientY - rectangle.top) / rectangle.height) * viewport.height

    if (
      !hasPointer ||
      hasPointerPositionChanged(
        pointerScreenX,
        pointerScreenY,
        nextPointerScreenX,
        nextPointerScreenY,
        POINTER_AIM_UPDATE_DISTANCE,
      )
    ) {
      pointerScreenX = nextPointerScreenX
      pointerScreenY = nextPointerScreenY
      pointerRevision += 1
    }

    hasPointer = true
  }

  function handleBlur(): void {
    pressedKeys.clear()
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleBlur)
  canvas.addEventListener('pointermove', handlePointerMove)

  return Object.freeze({
    sample(target: InputState) {
      target.horizontal =
        Number(pressedKeys.has('KeyD')) - Number(pressedKeys.has('KeyA'))
      target.vertical =
        Number(pressedKeys.has('KeyS')) - Number(pressedKeys.has('KeyW'))
      target.pointerScreenX = pointerScreenX
      target.pointerScreenY = pointerScreenY
      target.hasPointer = hasPointer
      target.pointerRevision = pointerRevision
    },

    dispose() {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      canvas.removeEventListener('pointermove', handlePointerMove)
      pressedKeys.clear()
    },
  })
}
