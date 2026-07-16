import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GLYPH_APPEARANCE_PROFILE,
  defineCombatVisualTheme,
  type HexColor,
} from '../../src/game/content/visuals/combatVisualTheme.ts'
import {
  PROTOTYPE_COMBAT_VISUAL_THEME,
  PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING,
} from '../../src/game/content/visuals/prototypeCombatVisualTheme.ts'

function parseExpectedTint(color: HexColor): number {
  return Number.parseInt(color.slice(1), 16)
}

test('converts readable #RRGGBB authoring colors to runtime tints once', () => {
  const authoring = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  const prepared = PROTOTYPE_COMBAT_VISUAL_THEME

  assert.equal(
    prepared.map.canvasBackground.tint,
    parseExpectedTint(authoring.map.canvasBackground.tint),
  )
  assert.equal(
    prepared.glyphAppearances.BAT.impactBaseTint,
    parseExpectedTint(authoring.glyphAppearances.BAT.impactBaseTint),
  )
  assert.equal(
    prepared.drops.experience.flash.tint,
    parseExpectedTint(authoring.drops.experience.flash.tint),
  )
  assert.equal(
    prepared.playerSurvival.shield.base.tint,
    parseExpectedTint(authoring.playerSurvival.shield.base.tint),
  )
  assert.equal(
    prepared.playerSurvival.healthDamage.fragment.tint,
    parseExpectedTint(authoring.playerSurvival.healthDamage.fragment.tint),
  )
  assert.equal(
    prepared.effects.topologyTransfer.tint,
    parseExpectedTint(authoring.effects.topologyTransfer.tint),
  )
})

test('rejects invalid topology-transfer timing', () => {
  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        topologyTransfer: {
          ...theme.effects.topologyTransfer,
          stepIntervalMs: 0,
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        topologyTransfer: {
          ...theme.effects.topologyTransfer,
          pulseDurationMs: Number.NaN,
        },
      },
    }),
  )
})

test('rejects invalid player survival animation tuning', () => {
  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      playerSurvival: {
        ...theme.playerSurvival,
        healthDamage: {
          ...theme.playerSurvival.healthDamage,
          fragmentCount: -1,
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      playerSurvival: {
        ...theme.playerSurvival,
        shield: {
          ...theme.playerSurvival.shield,
          restoreDurationMs: 0,
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      playerSurvival: {
        ...theme.playerSurvival,
        shield: {
          ...theme.playerSurvival.shield,
          glowBlurKernelSize: 6,
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      playerSurvival: {
        ...theme.playerSurvival,
        shield: {
          ...theme.playerSurvival.shield,
          glowRadiusX: 0,
        },
      },
    }),
  )
})

test('rejects non-#RRGGBB authoring color formats', () => {
  for (const invalidColor of [
    '#fff',
    '#ffffff00',
    'red',
    'ffffff',
    '#gg0000',
  ]) {
    const invalidTheme = {
      ...PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING,
      player: {
        ...PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING.player,
        tint: invalidColor as HexColor,
      },
    }

    assert.throws(
      () => defineCombatVisualTheme(invalidTheme),
      /player tint must use #RRGGBB format/,
    )
  }
})

test('accepts arbitrary valid palette colors without aesthetic validation', () => {
  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  const bat = theme.glyphAppearances.BAT
  const freelyTunedTheme = {
    ...theme,
    playerAttacks: {
      ...theme.playerAttacks,
      ASSISTED_PROJECTILE: {
        ...theme.playerAttacks.ASSISTED_PROJECTILE,
        core: { tint: '#000000' as const, alpha: 1 },
      },
    },
    glyphAppearances: {
      ...theme.glyphAppearances,
      [GLYPH_APPEARANCE_PROFILE.BAT]: {
        ...bat,
        durabilityBaseTints: ['#ffffff'] as const,
        impactBaseTint: '#000000' as const,
        huskBaseTint: '#ffffff' as const,
      },
    },
    drops: {
      ...theme.drops,
      experience: {
        ...theme.drops.experience,
        fresh: { tint: '#000000' as const, alpha: 1 },
        settled: { tint: '#ffffff' as const, alpha: 1 },
        flash: { tint: '#ffffff' as const, alpha: 1 },
      },
    },
  }

  const preparedTheme = defineCombatVisualTheme(freelyTunedTheme)
  assert.equal(
    preparedTheme.glyphAppearances.BAT.durabilityBaseTints[0],
    0xffffff,
  )
})
