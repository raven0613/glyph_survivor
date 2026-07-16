import {
  RUN_MODIFIER_EFFECT_STRATEGY,
  defineRunModifier,
  type RunModifierDefinition,
} from './runModifierDefinition.ts'

export const RUN_MODIFIER_DEFINITION_ID = Object.freeze({
  VOLATILE: 'modifier.volatile',
  DISCONNECTED: 'modifier.disconnected',
  OVERLOAD: 'modifier.overload',
})

export function preparePrototypeRunModifiers(): readonly Readonly<RunModifierDefinition>[] {
  return Object.freeze([
    defineRunModifier({
      id: RUN_MODIFIER_DEFINITION_ID.VOLATILE,
      title: 'VOLATILE — 不穩定結構',
      description:
        'Cell 首次進入 HUSK 時，傷害同一身體中相鄰的存活 Cell。',
      identityGlyph: '*',
      effectStrategyId: RUN_MODIFIER_EFFECT_STRATEGY.VOLATILE,
      volatile: {
        sourceMaxDurabilityRatio: 0.35,
        maximumExplosionDamage: 0.75,
        intraOwnerTopologyDepth: 1,
        maxExplosionResolutionsPerFixedStep: 64,
      },
    }),
    defineRunModifier({
      id: RUN_MODIFIER_DEFINITION_ID.DISCONNECTED,
      title: 'DISCONNECTED — 結構失聯',
      description: '較小的存活斷片受到直接攻擊時，承受更高傷害。',
      identityGlyph: '/',
      effectStrategyId: RUN_MODIFIER_EFFECT_STRATEGY.DISCONNECTED,
      disconnected: {
        protectedComponentRatio: 0.8,
        isolationBonusScale: 0.6,
        maximumDamageMultiplier: 1.6,
      },
    }),
    defineRunModifier({
      id: RUN_MODIFIER_DEFINITION_ID.OVERLOAD,
      title: 'OVERLOAD — 耐久過載',
      description:
        '單次直接重擊會使相鄰 Cell 裂傷，強化其下一次直接受擊。',
      identityGlyph: '!',
      effectStrategyId: RUN_MODIFIER_EFFECT_STRATEGY.OVERLOAD,
      overload: {
        overloadThresholdRatio: 0.6,
        crackDamageMultiplier: 1.4,
      },
    }),
  ])
}
