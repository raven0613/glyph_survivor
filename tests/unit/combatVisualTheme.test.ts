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

test('prepares bounded RHOMBUS hostile-spike and collapse roles', () => {
  const prepared = PROTOTYPE_COMBAT_VISUAL_THEME.effects.rhombus
  assert.ok(prepared.hostileSpike.dissipationDurationMs > 0)
  assert.ok(prepared.hostileSpike.fadeOutStartRatio < 1)
  assert.ok(prepared.hostileSpike.particleCharacters.length > 0)
  assert.ok(prepared.collapse.brightnessLiftDurationMs > 0)
  assert.equal(Object.isFrozen(prepared.hostileSpike), true)
  assert.equal(Object.isFrozen(prepared.hostileSpike.particleCharacters), true)

  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        rhombus: {
          ...theme.effects.rhombus,
          hostileSpike: {
            ...theme.effects.rhombus.hostileSpike,
            fadeOutStartRatio: 1,
          },
        },
      },
    }),
  )
})

test('prepares and validates bounded OVERLOAD presentation roles', () => {
  const prepared = PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.overload
  assert.ok(prepared.compression.attackDurationMs > 0)
  assert.ok(prepared.compression.holdDurationMs > 0)
  assert.ok(prepared.compression.settleDurationMs > 0)
  assert.ok(prepared.compression.parallelScale < 1)
  assert.ok(prepared.compression.perpendicularScale >= 1)
  assert.equal(prepared.crackedSurface.fragmentBrightnessGains.length, 3)

  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          overload: {
            ...theme.effects.runModifiers.overload,
            compression: {
              ...theme.effects.runModifiers.overload.compression,
              holdDurationMs: 0,
            },
          },
        },
      },
    }),
  )
})

test('prepares and validates bounded VOLATILE domino cluster roles', () => {
  const prepared =
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.volatile
  const authoring =
    PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING.effects.runModifiers.volatile
  assert.ok(prepared.sourceClamp.minimumScale < 1)
  assert.equal(prepared.release.characters.length, 4)
  assert.ok(prepared.release.delayMs >= 0)
  assert.ok(prepared.neighborJolt.maximumOffset > 0)
  assert.ok(
    prepared.clusterBurst.minimumClusterCount <=
      prepared.clusterBurst.maximumClusterCount,
  )
  assert.ok(
    prepared.clusterBurst.minimumPointsPerCluster <=
      prepared.clusterBurst.maximumPointsPerCluster,
  )
  assert.equal(
    prepared.clusterBurst.tint,
    parseExpectedTint(authoring.clusterBurst.tint),
  )
  assert.equal(Object.isFrozen(prepared.clusterBurst), true)
  assert.equal(Object.isFrozen(prepared.clusterBurst.characters), true)
  assert.equal(Object.isFrozen(prepared.clusterBurst.centerHighlight), true)

  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          volatile: {
            ...theme.effects.runModifiers.volatile,
            release: {
              ...theme.effects.runModifiers.volatile.release,
              characters: ['-', '|'],
            },
          },
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          volatile: {
            ...theme.effects.runModifiers.volatile,
            clusterBurst: {
              ...theme.effects.runModifiers.volatile.clusterBurst,
              minimumClusterCount:
                theme.effects.runModifiers.volatile.clusterBurst
                  .maximumClusterCount + 1,
            },
          },
        },
      },
    }),
  )
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          volatile: {
            ...theme.effects.runModifiers.volatile,
            clusterBurst: {
              ...theme.effects.runModifiers.volatile.clusterBurst,
              characters: [],
            },
          },
        },
      },
    }),
  )
})

test('prepares and validates low-duty DISCONNECTED motion roles', () => {
  const prepared =
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.disconnected
  const burstDuration =
    prepared.ambient.attackDurationMs +
    prepared.ambient.holdDurationMs +
    prepared.ambient.settleDurationMs
  assert.ok(burstDuration < prepared.ambient.intervalMs)
  assert.ok(prepared.ambient.maximumSpacingOffset > 0)
  assert.ok(prepared.hitShake.maximumOffset > 0)

  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          disconnected: {
            ...theme.effects.runModifiers.disconnected,
            ambient: {
              ...theme.effects.runModifiers.disconnected.ambient,
              intervalMs: 1,
            },
          },
        },
      },
    }),
  )
})

test('prepares and validates the central Run Modifier motion clamp', () => {
  const prepared =
    PROTOTYPE_COMBAT_VISUAL_THEME.effects.runModifiers.composition
  assert.ok(prepared.maximumOffset > 0)
  assert.ok(prepared.maximumRotation > 0)
  assert.equal(Object.isFrozen(prepared), true)

  const theme = PROTOTYPE_COMBAT_VISUAL_THEME_AUTHORING
  assert.throws(() =>
    defineCombatVisualTheme({
      ...theme,
      effects: {
        ...theme.effects,
        runModifiers: {
          ...theme.effects.runModifiers,
          composition: {
            ...theme.effects.runModifiers.composition,
            maximumOffset: 0,
          },
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
