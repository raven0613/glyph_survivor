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
  readonly enemyBehindLayer: ParticleContainer<Particle>
  readonly enemyLayer: ParticleContainer<Particle>
  readonly enemyFrontLayer: ParticleContainer<Particle>
  readonly crackedSurfaceLayer: ParticleContainer<Particle>
  readonly overloadDeformationLayer: Container
  readonly overloadShockwaveLayer: ParticleContainer<Particle>
  readonly volatileCoreOverlayLayer: ParticleContainer<Particle>
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

function createEnemyGlyphLayer(
  atlas: GlyphAtlas,
  label: string,
): ParticleContainer<Particle> {
  return new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    label,
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
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
  const enemyBehindLayer = createEnemyGlyphLayer(atlas, 'enemy-behind')
  const enemyLayer = createEnemyGlyphLayer(atlas, 'enemy-body')
  const enemyFrontLayer = createEnemyGlyphLayer(atlas, 'enemy-front')
  const crackedSurfaceLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    label: 'cracked-glyph-surfaces',
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const overloadDeformationLayer = new Container({
    label: 'overload-deformations',
    boundsArea: createWorldBounds(),
  })
  overloadDeformationLayer.eventMode = 'none'
  overloadDeformationLayer.interactiveChildren = false
  const overloadShockwaveLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    label: 'overload-shockwaves',
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  const volatileCoreOverlayLayer = new ParticleContainer<Particle>({
    texture: atlas.printableFrames[0],
    boundsArea: createWorldBounds(),
    label: 'volatile-core-overlays',
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
  })
  volatileCoreOverlayLayer.blendMode = 'add'
  const projectileLayer = new ParticleContainer<Particle>({
    texture: atlas.frames.projectile,
    boundsArea: createWorldBounds(),
    dynamicProperties: {
      position: true,
      rotation: true,
      vertex: true,
      uvs: false,
      color: true,
    },
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
    enemyBehindLayer,
    enemyLayer,
    enemyFrontLayer,
    crackedSurfaceLayer,
    overloadDeformationLayer,
    topologyTransferPulseLayer,
    effectLayer,
    overloadShockwaveLayer,
    volatileCoreOverlayLayer,
    flameLayer,
    projectileLayer,
    orbitLayer,
    playerRoot,
  )
  stage.addChild(worldRoot)

  return Object.freeze({
    worldRoot,
    enemyBehindLayer,
    enemyLayer,
    enemyFrontLayer,
    crackedSurfaceLayer,
    overloadDeformationLayer,
    overloadShockwaveLayer,
    volatileCoreOverlayLayer,
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
