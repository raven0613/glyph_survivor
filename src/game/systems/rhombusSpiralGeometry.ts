const SOLVER_ITERATION_COUNT = 6

function getArcLengthPrimitive(radius: number, tightness: number): number {
  return (
    radius * Math.hypot(radius, tightness) +
    tightness * tightness * Math.asinh(radius / tightness)
  )
}

export function getArchimedeanSpiralArcLength(
  thetaRadians: number,
  tightness: number,
  initialRadius: number,
): number {
  if (thetaRadians <= 0) {
    return 0
  }
  const radius = initialRadius + tightness * thetaRadians
  return (
    (getArcLengthPrimitive(radius, tightness) -
      getArcLengthPrimitive(initialRadius, tightness)) /
    (2 * tightness)
  )
}

/** Deterministically inverts Archimedean-spiral arc length without allocation. */
export function solveArchimedeanSpiralTheta(
  pathDistance: number,
  tightness: number,
  initialRadius: number,
): number {
  if (pathDistance <= 0) {
    return 0
  }
  let thetaRadians =
    (Math.sqrt(
      initialRadius * initialRadius + 2 * tightness * pathDistance,
    ) -
      initialRadius) /
    tightness
  for (let index = 0; index < SOLVER_ITERATION_COUNT; index += 1) {
    const error =
      getArchimedeanSpiralArcLength(
        thetaRadians,
        tightness,
        initialRadius,
      ) - pathDistance
    const radius = initialRadius + tightness * thetaRadians
    thetaRadians = Math.max(
      0,
      thetaRadians - error / Math.hypot(radius, tightness),
    )
  }
  return thetaRadians
}

export interface ArchimedeanSpiralPose {
  x: number
  y: number
  tangentX: number
  tangentY: number
  tangentRotation: number
}

export function writeArchimedeanSpiralPose(
  output: ArchimedeanSpiralPose,
  originX: number,
  originY: number,
  thetaRadians: number,
  tightness: number,
  initialRadius: number,
  initialPhaseRadians: number,
  directionSign: -1 | 1,
): void {
  const angle = initialPhaseRadians + directionSign * thetaRadians
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const radius = initialRadius + tightness * thetaRadians
  output.x = originX + cosine * radius
  output.y = originY + sine * radius

  const derivativeX = tightness * cosine - directionSign * radius * sine
  const derivativeY = tightness * sine + directionSign * radius * cosine
  const derivativeLength = Math.hypot(derivativeX, derivativeY)
  output.tangentX = derivativeX / derivativeLength
  output.tangentY = derivativeY / derivativeLength
  output.tangentRotation = Math.atan2(output.tangentY, output.tangentX)
}
