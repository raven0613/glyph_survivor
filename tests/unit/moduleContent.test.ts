import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MODULE_EFFECT_KIND,
  defineWeaponModule,
  type ModuleEffectKind,
  type WeaponModuleDefinitionInput,
} from '../../src/game/content/upgrades/moduleDefinition.ts'
import {
  PROTOTYPE_WEAPON_MODULE_ID,
  preparePrototypeRangeModule,
  preparePrototypeWeaponModules,
} from '../../src/game/content/upgrades/prototypeWeaponModules.ts'

test('copies and freezes one contiguous Module Rank table', () => {
  const ranks = [
    { rank: 1, totalMultiplier: 1.1 },
    { rank: 2, totalMultiplier: 1.25 },
  ]
  const definition = defineWeaponModule({
    id: 'module.test-valid',
    title: 'Valid',
    description: 'Valid module.',
    effectKind: MODULE_EFFECT_KIND.ATTACK_SPEED,
    ranks,
  })
  ranks[0].totalMultiplier = 99

  assert.equal(definition.ranks[0].totalMultiplier, 1.1)
  assert.equal(Object.isFrozen(definition), true)
  assert.equal(Object.isFrozen(definition.ranks), true)
  assert.equal(Object.isFrozen(definition.ranks[0]), true)
})

test('rejects an unknown Module effect before content preparation completes', () => {
  assert.throws(
    () =>
      defineWeaponModule(
        {
          id: 'module.test-unknown',
          title: 'Unknown',
          description: 'Unknown effect.',
          effectKind: 'UNKNOWN' as ModuleEffectKind,
          ranks: [{ rank: 1, totalMultiplier: 1.1 }],
        } as unknown as WeaponModuleDefinitionInput,
      ),
    /effectKind/,
  )
})

test('copies and freezes complete Damage Spread band ratios for every Rank', () => {
  const ratios = [0.2, 0.1]
  const definition = defineWeaponModule({
    id: 'module.test-spread',
    title: 'Damage Spread',
    description: 'Damages living Glyphs outside the primary shape.',
    effectKind: MODULE_EFFECT_KIND.DAMAGE_SPREAD,
    bandWidth: 24,
    ranks: [
      { rank: 1, bandDamageRatios: [0.2] },
      { rank: 2, bandDamageRatios: ratios },
    ],
  })
  ratios[0] = 99

  assert.equal(definition.bandWidth, 24)
  assert.deepEqual(definition.ranks[1].bandDamageRatios, [0.2, 0.1])
  assert.equal(Object.isFrozen(definition.ranks[1].bandDamageRatios), true)
})

test('rejects Damage Spread ranks whose outer bands do not decrease', () => {
  assert.throws(
    () =>
      defineWeaponModule({
        id: 'module.test-invalid-spread',
        title: 'Invalid Spread',
        description: 'Invalid spread module.',
        effectKind: MODULE_EFFECT_KIND.DAMAGE_SPREAD,
        bandWidth: 24,
        ranks: [{ rank: 1, bandDamageRatios: [0.1, 0.2] }],
      }),
    /band damage ratios/,
  )
})

test('copies and freezes Projectile Count totals and pattern spacing', () => {
  const ranks = [
    { rank: 1, totalCount: 2 },
    { rank: 2, totalCount: 3 },
    { rank: 3, totalCount: 4 },
  ]
  const definition = defineWeaponModule({
    id: 'module.test-projectile-count',
    title: 'Projectile Count',
    description: 'Emits more attacks per pattern.',
    effectKind: MODULE_EFFECT_KIND.PROJECTILE_COUNT,
    projectileAngleSpacingRadians: (8 * Math.PI) / 180,
    coneAngleSpacingRadians: (10 * Math.PI) / 180,
    ranks,
  })
  ranks[0].totalCount = 99

  assert.deepEqual(
    definition.ranks.map(({ totalCount }) => totalCount),
    [2, 3, 4],
  )
  assert.equal(
    definition.projectileAngleSpacingRadians,
    (8 * Math.PI) / 180,
  )
  assert.equal(definition.coneAngleSpacingRadians, (10 * Math.PI) / 180)
  assert.equal(Object.isFrozen(definition.ranks[0]), true)
})

test('rejects Projectile Count ranks that do not increase total emissions', () => {
  assert.throws(
    () =>
      defineWeaponModule({
        id: 'module.test-invalid-projectile-count',
        title: 'Invalid Projectile Count',
        description: 'Invalid count module.',
        effectKind: MODULE_EFFECT_KIND.PROJECTILE_COUNT,
        projectileAngleSpacingRadians: (8 * Math.PI) / 180,
        coneAngleSpacingRadians: (10 * Math.PI) / 180,
        ranks: [
          { rank: 1, totalCount: 2 },
          { rank: 2, totalCount: 2 },
        ],
      }),
    /strictly increase/,
  )
})

test('prepares and registers the completed Range Rank totals', () => {
  const range = preparePrototypeRangeModule()

  assert.equal(range.id, PROTOTYPE_WEAPON_MODULE_ID.RANGE)
  assert.equal(range.effectKind, MODULE_EFFECT_KIND.RANGE)
  assert.deepEqual(
    range.ranks.map(({ totalMultiplier }) => totalMultiplier),
    [1.15, 1.3, 1.5],
  )
  assert.equal(Object.isFrozen(range), true)
  assert.equal(Object.isFrozen(range.ranks), true)
  assert.equal(
    preparePrototypeWeaponModules().some(
      ({ id }) => id === PROTOTYPE_WEAPON_MODULE_ID.RANGE,
    ),
    true,
  )
})

test('rejects Range Rank totals that do not strictly increase from base reach', () => {
  assert.throws(
    () =>
      defineWeaponModule({
        id: 'module.test-invalid-range-base',
        title: 'Invalid Range',
        description: 'Invalid base reach multiplier.',
        effectKind: MODULE_EFFECT_KIND.RANGE,
        ranks: [{ rank: 1, totalMultiplier: 1 }],
      }),
    /strictly increase from base reach/,
  )
  assert.throws(
    () =>
      defineWeaponModule({
        id: 'module.test-invalid-range-sequence',
        title: 'Invalid Range',
        description: 'Invalid reach multiplier sequence.',
        effectKind: MODULE_EFFECT_KIND.RANGE,
        ranks: [
          { rank: 1, totalMultiplier: 1.15 },
          { rank: 2, totalMultiplier: 1.1 },
        ],
      }),
    /strictly increase from base reach/,
  )
})
