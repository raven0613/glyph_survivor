export type ProjectileTrackingMode = 'ASSISTED' | 'HOMING'
export type ProjectileTrackingState = 'LOCKED' | 'SEEKING' | 'BALLISTIC'

export interface ProjectileTrackingProfile {
  readonly mode: ProjectileTrackingMode
  readonly range: number
  readonly responsiveness: number
  readonly maximumCorrectionCos: number
  readonly retargetIntervalMs: number
}

const degreesToRadians = Math.PI / 180

export const ASSISTED_PROJECTILE_TRACKING: ProjectileTrackingProfile =
  Object.freeze({
    mode: 'ASSISTED',
    range: 700,
    responsiveness: 3,
    maximumCorrectionCos: Math.cos(35 * degreesToRadians),
    retargetIntervalMs: Number.POSITIVE_INFINITY,
  })

/** Available to true homing weapons; the current basic weapon does not use it. */
export const HOMING_PROJECTILE_TRACKING: ProjectileTrackingProfile =
  Object.freeze({
    mode: 'HOMING',
    range: 900,
    responsiveness: 8,
    maximumCorrectionCos: -1,
    retargetIntervalMs: 100,
  })
