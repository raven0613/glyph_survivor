import type {
  BossModifierRewardToken,
  RunModifierOffer,
} from '../runtime/runModifierState.ts'
import type { WorldState } from '../runtime/worldState.ts'
import { createBossRewardModifierOffer } from './runModifierOffer.ts'

function enqueueRewardToken(
  world: WorldState,
  bossEncounterId: number,
): void {
  const state = world.runModifierState
  if (state.bossRewardTokenEncounterIds.has(bossEncounterId)) {
    return
  }
  const token: Readonly<BossModifierRewardToken> = Object.freeze({
    id: `boss-modifier-reward-${state.nextBossRewardTokenId}`,
    bossEncounterId,
  })
  state.nextBossRewardTokenId += 1
  state.bossRewardTokenEncounterIds.add(bossEncounterId)
  state.pendingBossRewardTokens.push(token)
}

/** Authorizes each formally defeated Encounter once and opens the oldest token. */
export function runBossModifierRewardSystem(
  world: WorldState,
): Readonly<RunModifierOffer> | null {
  const defeatedEncounterIds = [...world.bossEncounters.values()]
    .filter(({ phase }) => phase === 'DEFEATED')
    .map(({ id }) => id)
    .sort((first, second) => first - second)
  for (const encounterId of defeatedEncounterIds) {
    enqueueRewardToken(world, encounterId)
  }

  const state = world.runModifierState
  if (state.activeAuthorization || state.activeOffer) {
    return null
  }
  const token = state.pendingBossRewardTokens[0]
  if (!token) {
    return null
  }
  const offer = createBossRewardModifierOffer(
    world.content.runModifierDefinitions,
    state,
    token.bossEncounterId,
  )
  state.pendingBossRewardTokens.shift()
  return offer
}
