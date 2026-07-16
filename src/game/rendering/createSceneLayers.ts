import {
  Container,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
} from 'pixi.js'
import type { GlyphAtlas } from './createGlyphAtlas.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'

export interface SceneLayers {
  readonly worldRoot: Container
  readonly enemyLayer: ParticleContainer<Particle>
  readonly topologyTransferPulseLayer: ParticleContainer<Particle>
  readonly effectLayer: ParticleContainer<Particle>
  readonly flameLayer: ParticleContainer<Particle>
  readonly projectileLayer: ParticleContainer<Particle>
  readonly orbitLayer: ParticleContainer<Particle>
  readonly dropLayer: ParticleContainer<Particle>
  readonly playerRoot: Container
  readonly player: Sprite
}

function createWorldBounds(): Rectangle {
  return new Rectangle(0, 0, GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight)
}

function createBackground(
  atlas: GlyphAtlas,
  visualTheme: CombatVisualTheme,
): ParticleContainer<Particle> {
  const particles: Particle[] = []
  const spacing = 160

  for (let y = spacing / 2; y < GAME_CONFIG.worldHeight; y += spacing) {
    for (let x = spacing / 2; x < GAME_CONFIG.worldWidth; x += spacing) {
      particles.push(
        new Particle({
          texture: atlas.frames.background,
          x,
          y,
          scaleX: 0.28,
          scaleY: 0.28,
          anchorX: 0.5,
          anchorY: 0.5,
          tint: visualTheme.map.backgroundGlyph.tint,
          alpha: visualTheme.map.backgroundGlyph.alpha,
        }),
      )
    }
  }

  const backgroundLayer = new ParticleContainer({
    texture: atlas.frames.background,
    particles,
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: false,
      rotation: false,
      vertex: false,
      uvs: false,
      color: false,
    },
  })

  // Pre-populated static properties must be uploaded before the first draw.
  backgroundLayer.update()
  return backgroundLayer
}

export function createSceneLayers(
  stage: Container,
  atlas: GlyphAtlas,
  visualTheme: CombatVisualTheme,
): SceneLayers {
  const worldRoot = new Container({ label: 'world-root' })
  worldRoot.eventMode = 'none'
  worldRoot.interactiveChildren = false

  const backgroundLayer = createBackground(atlas, visualTheme)
  const dropLayer = new ParticleContainer<Particle>({
    texture: atlas.frames.experience,
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: false,
      vertex: false,
      uvs: false,
      color: true,
    },
  })
  const enemyLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const projectileLayer = new ParticleContainer<Particle>({
    texture: atlas.frames.projectile,
    boundsArea: createWorldBounds(),
  })
  const topologyTransferPulseLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    label: 'topology-transfer-pulses',
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const orbitLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: false,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const effectLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: false,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const flameLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: false,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const player = new Sprite({
    texture: atlas.frames.player,
    anchor: 0.5,
    tint: visualTheme.player.tint,
    alpha: visualTheme.player.alpha,
    label: 'player-glyph',
  })
  player.eventMode = 'none'
  player.scale.set(0.88)
  const playerRoot = new Container({ label: 'player-root' })
  playerRoot.eventMode = 'none'
  playerRoot.interactiveChildren = false
  playerRoot.addChild(player)

  worldRoot.addChild(
    backgroundLayer,
    dropLayer,
    enemyLayer,
    topologyTransferPulseLayer,
    effectLayer,
    flameLayer,
    projectileLayer,
    orbitLayer,
    playerRoot,
  )
  stage.addChild(worldRoot)

  return Object.freeze({
    worldRoot,
    enemyLayer,
    topologyTransferPulseLayer,
    effectLayer,
    flameLayer,
    projectileLayer,
    orbitLayer,
    dropLayer,
    playerRoot,
    player,
  })
}
