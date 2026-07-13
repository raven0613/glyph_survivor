import {
  Container,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
} from 'pixi.js'
import type { GlyphAtlas } from './createGlyphAtlas.ts'
import { GAME_CONFIG } from '../runtime/gameConfig.ts'

export interface SceneLayers {
  readonly worldRoot: Container
  readonly enemyLayer: ParticleContainer<Particle>
  readonly effectLayer: ParticleContainer<Particle>
  readonly projectileLayer: ParticleContainer<Particle>
  readonly dropLayer: ParticleContainer<Particle>
  readonly player: Sprite
}

function createWorldBounds(): Rectangle {
  return new Rectangle(0, 0, GAME_CONFIG.worldWidth, GAME_CONFIG.worldHeight)
}

function createBackground(atlas: GlyphAtlas): ParticleContainer<Particle> {
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
          tint: 0x252525,
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
): SceneLayers {
  const worldRoot = new Container({ label: 'world-root' })
  worldRoot.eventMode = 'none'
  worldRoot.interactiveChildren = false

  const backgroundLayer = createBackground(atlas)
  const dropLayer = new ParticleContainer<Particle>({
    texture: atlas.frames.experience,
    boundsArea: createWorldBounds(),
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
  const player = new Sprite({
    texture: atlas.frames.player,
    anchor: 0.5,
    tint: 0x00ff88,
    label: 'player-glyph',
  })
  player.eventMode = 'none'
  player.scale.set(0.88)

  worldRoot.addChild(
    backgroundLayer,
    dropLayer,
    enemyLayer,
    effectLayer,
    projectileLayer,
    player,
  )
  stage.addChild(worldRoot)

  return Object.freeze({
    worldRoot,
    enemyLayer,
    effectLayer,
    projectileLayer,
    dropLayer,
    player,
  })
}
