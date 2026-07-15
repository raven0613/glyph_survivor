import { BlurFilter, Container, Graphics, Sprite } from 'pixi.js'
import type { RenderPlayerSurvivalPresentation } from '../bridge/playerRenderSnapshot.ts'
import type { CombatVisualTheme } from '../content/visuals/combatVisualTheme.ts'
import { getPrintableAsciiGlyphFrame } from '../glyph/glyphFrame.ts'
import type { GlyphAtlas } from './createGlyphAtlas.ts'
import {
  createPlayerSurvivalPresentationFrame,
  writePlayerSurvivalPresentationFrame,
} from './playerSurvivalPresentationMotion.ts'

export interface PlayerSurvivalView {
  sync(snapshot: Readonly<RenderPlayerSurvivalPresentation>): void
  clear(): void
}

function createGlyphSprite(
  texture: GlyphAtlas['printableFrames'][number],
  label: string,
): Sprite {
  const sprite = new Sprite({ texture, anchor: 0.5, label })
  sprite.eventMode = 'none'
  sprite.visible = false
  return sprite
}

function createMatteGlow(
  radiusX: number,
  radiusY: number,
  tint: number,
  label: string,
): Graphics {
  const glow = new Graphics({ label })
    .ellipse(0, 0, radiusX, radiusY)
    .fill({ color: tint })
  glow.eventMode = 'none'
  glow.visible = false
  return glow
}

export function createPlayerSurvivalView(
  root: Container,
  player: Sprite,
  atlas: GlyphAtlas,
  theme: CombatVisualTheme,
): PlayerSurvivalView {
  const leftTexture =
    atlas.printableFrames[getPrintableAsciiGlyphFrame('(')]
  const rightTexture =
    atlas.printableFrames[getPrintableAsciiGlyphFrame(')')]
  const fragmentTexture =
    atlas.printableFrames[getPrintableAsciiGlyphFrame('.')]
  const leftShield = createGlyphSprite(leftTexture, 'player-shield-left')
  const rightShield = createGlyphSprite(rightTexture, 'player-shield-right')
  const shield = theme.playerSurvival.shield
  const leftGlow = createMatteGlow(
    shield.glowRadiusX,
    shield.glowRadiusY,
    shield.glow.tint,
    'player-shield-left-glow',
  )
  const rightGlow = createMatteGlow(
    shield.glowRadiusX,
    shield.glowRadiusY,
    shield.glow.tint,
    'player-shield-right-glow',
  )
  const glowBlur = new BlurFilter({
    strength: shield.glowBlurStrength,
    quality: shield.glowBlurQuality,
    kernelSize: shield.glowBlurKernelSize,
    resolution: shield.glowBlurResolution,
    padding: shield.glowBlurPadding,
  })
  leftGlow.filters = [glowBlur]
  rightGlow.filters = [glowBlur]
  const fragmentCount = theme.playerSurvival.healthDamage.fragmentCount
  const fragments = Array.from({ length: fragmentCount }, (_, index) =>
    createGlyphSprite(fragmentTexture, `player-damage-fragment-${index}`),
  )
  const frame = createPlayerSurvivalPresentationFrame(fragmentCount)

  root.addChildAt(leftGlow, 0)
  root.addChildAt(rightGlow, 1)
  root.addChildAt(leftShield, 2)
  root.addChildAt(rightShield, 3)
  root.addChild(...fragments)

  function clear(): void {
    player.position.set(0, 0)
    player.tint = theme.player.tint
    player.alpha = theme.player.alpha
    leftGlow.visible = false
    rightGlow.visible = false
    leftShield.visible = false
    rightShield.visible = false
    for (const fragment of fragments) {
      fragment.visible = false
    }
  }

  return Object.freeze({
    sync(snapshot: Readonly<RenderPlayerSurvivalPresentation>) {
      writePlayerSurvivalPresentationFrame(snapshot, theme, frame)
      player.position.set(frame.playerOffsetX, frame.playerOffsetY)
      player.tint = frame.playerTint
      player.alpha = frame.playerAlpha

      leftShield.visible = frame.shieldVisible
      rightShield.visible = frame.shieldVisible
      leftGlow.visible = frame.shieldVisible
      rightGlow.visible = frame.shieldVisible
      leftShield.position.set(frame.shieldLeftX, frame.shieldLeftY)
      rightShield.position.set(frame.shieldRightX, frame.shieldRightY)
      leftGlow.position.copyFrom(leftShield.position)
      rightGlow.position.copyFrom(rightShield.position)
      leftShield.scale.set(shield.glyphScale)
      rightShield.scale.set(shield.glyphScale)
      leftShield.tint = shield.base.tint
      rightShield.tint = shield.base.tint
      leftShield.alpha = frame.shieldAlpha
      rightShield.alpha = frame.shieldAlpha
      leftGlow.alpha = frame.shieldGlowAlpha
      rightGlow.alpha = frame.shieldGlowAlpha

      const fragmentTheme = theme.playerSurvival.healthDamage.fragment
      for (let index = 0; index < fragments.length; index += 1) {
        const fragment = fragments[index]
        if (index >= frame.fragmentCount) {
          fragment.visible = false
          continue
        }
        const fragmentFrame = frame.fragments[index]
        fragment.visible = true
        fragment.position.set(fragmentFrame.x, fragmentFrame.y)
        fragment.scale.set(fragmentFrame.scale)
        fragment.tint = fragmentTheme.tint
        fragment.alpha = fragmentFrame.alpha
      }
    },
    clear,
  })
}
