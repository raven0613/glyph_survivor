import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type {
  UiEquippedWeapon,
  UiUpgradeChoice,
  UiWeaponModuleSlot,
} from '../../game/bridge/uiSnapshot.ts'
import {
  EMPTY_UPGRADE_SELECTION,
  resolveUpgradeDecision,
  selectUpgradeChoice,
  selectUpgradeSlot,
  selectUpgradeWeapon,
  stepBackUpgradeSelection,
  type UpgradeCommitCommand,
  type UpgradeDecision,
  type UpgradeOperation,
  type UpgradeSelection,
} from './upgradeDecision.ts'
import './UpgradeCards.scss'
import './UpgradeScreen.scss'

interface UpgradeScreenProps {
  readonly offerId: string
  readonly choices: readonly Readonly<UiUpgradeChoice>[]
  readonly equippedWeapons: readonly Readonly<UiEquippedWeapon>[]
  readonly maximumEquippedWeapons: number
  readonly pendingUpgradeCount: number
  readonly recoverableError: string | null
  readonly onCommit: (command: UpgradeCommitCommand) => void
}

function getRankLabel(rank: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][rank] ?? String(rank)
}

function getChoiceTitle(choice: Readonly<UiUpgradeChoice>): string {
  return choice.title ?? choice.definitionId
}

function getRankSummary(
  choice: Readonly<UiUpgradeChoice>,
  rank: number,
): string | null {
  return (
    choice.rankPreviews?.find((preview) => preview.rank === rank)?.summary ??
    null
  )
}

function getWeaponTargetPreview(
  choice: Readonly<UiUpgradeChoice>,
  weaponInstanceId: number,
): string | null {
  return (
    choice.weaponTargetPreviews?.find(
      (preview) => preview.weaponInstanceId === weaponInstanceId,
    )?.summary ?? null
  )
}

function getOperationLabel(operation: UpgradeOperation | null): string {
  switch (operation?.kind) {
    case 'ACQUIRE_WEAPON':
      return 'Allocate new weapon instance'
    case 'REPLACE_WEAPON':
      return 'Replace weapon instance'
    case 'INSTALL_MODULE':
      return `Compile into Slot ${operation.slotIndex + 1}`
    case 'RANK_UP_MODULE':
      return `Rank ${getRankLabel(operation.rankBefore)} → ${getRankLabel(operation.rankAfter)}`
    case 'REPLACE_MODULE':
      return `Overwrite Slot ${operation.slotIndex + 1}`
    default:
      return 'Awaiting target selection'
  }
}

function getInstruction(decision: UpgradeDecision): string {
  switch (decision.stage) {
    case 'CARD':
      return 'Select one compile directive.'
    case 'WEAPON':
      return decision.selectedChoice?.kind === 'WEAPON'
        ? 'Select the weapon instance to decommission.'
        : 'Select the weapon instance that receives this Module.'
    case 'SLOT':
      return 'Capacity reached. Select one Module Slot to overwrite.'
    case 'CONFIRM':
      return 'Review the diff, then authorize the Runtime transaction.'
  }
}

function updateCardTilt(event: PointerEvent<HTMLButtonElement>): void {
  const card = event.currentTarget
  const bounds = card.getBoundingClientRect()
  const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5
  const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5
  card.style.setProperty('--tilt-x', `${normalizedX * 8}deg`)
  card.style.setProperty('--tilt-y', `${normalizedY * -7}deg`)
  card.style.setProperty('--glow-x', `${(normalizedX + 0.5) * 100}%`)
  card.style.setProperty('--glow-y', `${(normalizedY + 0.5) * 100}%`)
}

function resetCardTilt(event: PointerEvent<HTMLButtonElement>): void {
  const card = event.currentTarget
  card.style.removeProperty('--tilt-x')
  card.style.removeProperty('--tilt-y')
  card.style.removeProperty('--glow-x')
  card.style.removeProperty('--glow-y')
}

interface WeaponTargetProps {
  readonly option: UpgradeDecision['weaponOptions'][number]
  readonly choice: Readonly<UiUpgradeChoice>
  readonly selected: boolean
  readonly onSelect: () => void
}

function WeaponTarget({ option, choice, selected, onSelect }: WeaponTargetProps) {
  const occupiedSlotCount = option.weapon.moduleSlots.filter(Boolean).length
  const targetRank =
    option.operation?.kind === 'RANK_UP_MODULE'
      ? option.operation.rankAfter
      : option.operation?.kind === 'INSTALL_MODULE' ||
          option.operation?.kind === 'REPLACE_MODULE'
        ? 1
        : null
  const rankSummary = targetRank ? getRankSummary(choice, targetRank) : null
  const weaponTargetPreview = getWeaponTargetPreview(
    choice,
    option.weapon.instanceId,
  )
  return (
    <button
      className={`upgrade-target${selected ? ' upgrade-target--selected' : ''}`}
      type="button"
      disabled={option.disabled}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="upgrade-target__glyph" aria-hidden="true">
        {option.weapon.identityGlyph}
      </span>
      <span className="upgrade-target__copy">
        <strong>{option.weapon.title}</strong>
        <span>
          INST {String(option.weapon.instanceId).padStart(2, '0')} /{' '}
          {occupiedSlotCount}:{option.weapon.moduleSlots.length} SLOTS
        </span>
      </span>
      <span className="upgrade-target__operation">
        {option.disabledReason ?? getOperationLabel(option.operation)}
        {rankSummary ? ` / ${rankSummary}` : ''}
        {weaponTargetPreview ? ` / ${weaponTargetPreview}` : ''}
      </span>
    </button>
  )
}

interface ModuleSlotButtonProps {
  readonly slot: Readonly<UiWeaponModuleSlot>
  readonly selected: boolean
  readonly onSelect: () => void
}

function ModuleSlotButton({ slot, selected, onSelect }: ModuleSlotButtonProps) {
  return (
    <button
      className={`upgrade-slot${selected ? ' upgrade-slot--selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span>Slot {String(slot.slotIndex + 1).padStart(2, '0')}</span>
      <strong>{slot.title}</strong>
      <span>
        Rank {getRankLabel(slot.rank)} / {getRankLabel(slot.maximumRank)}
      </span>
      <span className="upgrade-slot__warning">Will be destroyed</span>
    </button>
  )
}

interface OperationDiffProps {
  readonly choice: Readonly<UiUpgradeChoice>
  readonly operation: UpgradeOperation
}

function OperationDiff({ choice, operation }: OperationDiffProps) {
  let removed = 'NO EXISTING DATA'
  let added = getChoiceTitle(choice)

  if (operation.kind === 'REPLACE_WEAPON') {
    removed = `${operation.weapon.identityGlyph} ${operation.weapon.title}`
  } else if (operation.kind === 'INSTALL_MODULE') {
    removed = `SLOT ${operation.slotIndex + 1} / EMPTY`
    added = `${added} / RANK I`
  } else if (operation.kind === 'RANK_UP_MODULE') {
    removed = `${added} / RANK ${getRankLabel(operation.rankBefore)}`
    added = `${added} / RANK ${getRankLabel(operation.rankAfter)}`
  } else if (operation.kind === 'REPLACE_MODULE') {
    removed = `${operation.replacedSlot.title} / RANK ${getRankLabel(operation.replacedSlot.rank)}`
    added = `${added} / RANK I`
  }
  const targetRank =
    operation.kind === 'RANK_UP_MODULE'
      ? operation.rankAfter
      : operation.kind === 'INSTALL_MODULE' || operation.kind === 'REPLACE_MODULE'
        ? 1
        : null
  const rankSummary = targetRank ? getRankSummary(choice, targetRank) : null
  if (rankSummary) {
    added = `${added} / ${rankSummary}`
  }
  if ('weapon' in operation) {
    const weaponTargetPreview = getWeaponTargetPreview(
      choice,
      operation.weapon.instanceId,
    )
    if (weaponTargetPreview) {
      added = `${added} / ${weaponTargetPreview}`
    }
  }

  return (
    <div className="upgrade-diff" aria-label="Upgrade operation preview">
      <div className="upgrade-diff__header">
        <span>runtime/loadout.patch</span>
        <span>{getOperationLabel(operation)}</span>
      </div>
      <p className="upgrade-diff__removed">− {removed}</p>
      <p className="upgrade-diff__added">+ {added}</p>
      <p className="upgrade-diff__commit">✓ ATOMIC COMMIT / NO REFUND</p>
    </div>
  )
}

export function UpgradeScreen({
  offerId,
  choices,
  equippedWeapons,
  maximumEquippedWeapons,
  pendingUpgradeCount,
  recoverableError,
  onCommit,
}: UpgradeScreenProps) {
  const [selection, setSelection] = useState<UpgradeSelection>(
    EMPTY_UPGRADE_SELECTION,
  )
  const firstCardRef = useRef<HTMLButtonElement>(null)
  const decision = resolveUpgradeDecision(
    {
      offerId,
      choices,
      equippedWeapons,
      maximumEquippedWeapons,
    },
    selection,
  )
  const selectedChoice = decision.selectedChoice

  useEffect(() => {
    firstCardRef.current?.focus()
  }, [offerId])

  function handleBack(): void {
    setSelection((current) => stepBackUpgradeSelection(current))
  }

  function handleKeyboard(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape' && selection.choiceId !== null) {
      event.preventDefault()
      handleBack()
      return
    }
    const shortcutIndex = Number(event.key) - 1
    if (!Number.isInteger(shortcutIndex) || shortcutIndex < 0) {
      return
    }
    if (decision.stage === 'CARD' && choices[shortcutIndex]) {
      event.preventDefault()
      setSelection((current) =>
        selectUpgradeChoice(current, choices[shortcutIndex].id),
      )
      return
    }
    if (decision.stage === 'WEAPON') {
      const option = decision.weaponOptions[shortcutIndex]
      if (option && !option.disabled) {
        event.preventDefault()
        setSelection((current) =>
          selectUpgradeWeapon(current, option.weapon.instanceId),
        )
      }
      return
    }
    if (decision.stage === 'SLOT') {
      const slot = decision.selectedWeapon?.moduleSlots.filter(
        (value): value is Readonly<UiWeaponModuleSlot> => value !== null,
      )[shortcutIndex]
      if (slot) {
        event.preventDefault()
        setSelection((current) =>
          selectUpgradeSlot(current, slot.slotIndex),
        )
      }
    }
  }

  return (
    <section
      className="upgrade-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-screen-title"
      data-testid="upgrade-screen"
      onKeyDown={handleKeyboard}
    >
      <div className="upgrade-screen__noise" aria-hidden="true" />
      <header className="upgrade-screen__header">
        <div>
          <span className="upgrade-screen__interrupt">// SYSTEM INTERRUPT</span>
          <h1 id="upgrade-screen-title" data-text="LEVEL COMPILE">
            Level compile
          </h1>
        </div>
        <div className="upgrade-screen__queue">
          <span>OFFER {offerId.replace('upgrade-offer-', '#')}</span>
          <strong>{String(pendingUpgradeCount).padStart(2, '0')}</strong>
          <span>QUEUED</span>
        </div>
      </header>

      <p className="upgrade-screen__instruction" aria-live="polite">
        <span aria-hidden="true">[ {decision.stage} ]</span>{' '}
        {getInstruction(decision)}
      </p>

      <div className="upgrade-card-grid" aria-label="Upgrade choices">
        {choices.map((choice, index) => {
          const isSelected = decision.selectedChoice?.id === choice.id
          const orderStyle = {
            '--card-delay': `${100 + index * 90}ms`,
          } as CSSProperties
          return (
            <button
              ref={index === 0 ? firstCardRef : undefined}
              className={`upgrade-card upgrade-card--${choice.kind.toLowerCase()}${
                isSelected ? ' upgrade-card--selected' : ''
              }`}
              style={orderStyle}
              type="button"
              key={choice.id}
              aria-pressed={isSelected}
              data-testid={`upgrade-card-${index + 1}`}
              onClick={() =>
                setSelection((current) =>
                  selectUpgradeChoice(current, choice.id),
                )
              }
              onPointerMove={updateCardTilt}
              onPointerLeave={resetCardTilt}
            >
              <span className="upgrade-card__scan" aria-hidden="true" />
              <span className="upgrade-card__meta">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{choice.kind === 'WEAPON' ? 'WPN.EXE' : 'MOD.DLL'}</span>
              </span>
              <span className="upgrade-card__sigil" aria-hidden="true">
                {choice.kind === 'WEAPON' ? 'W' : '+'}
              </span>
              <span className="upgrade-card__type">{choice.kind}</span>
              <strong className="upgrade-card__title">
                {getChoiceTitle(choice)}
              </strong>
              <span className="upgrade-card__description">
                {choice.description ?? 'No description available.'}
                {choice.rankPreviews && (
                  <span className="upgrade-card__ranks">
                    {choice.rankPreviews.map((preview) => (
                      <span key={preview.rank}>
                        {getRankLabel(preview.rank)} {preview.summary}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="upgrade-card__footer">
                <span>SELECT [{index + 1}]</span>
                <span aria-hidden="true">↗</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="upgrade-decision-panel">
        {decision.stage === 'CARD' && (
          <div className="upgrade-decision-panel__idle" aria-hidden="true">
            <span>001101 / AWAITING DIRECTIVE / 110010</span>
          </div>
        )}

        {decision.stage === 'WEAPON' && selectedChoice && (
          <div className="upgrade-target-grid" aria-label="Weapon targets">
            {decision.weaponOptions.map((option) => (
              <WeaponTarget
                key={option.weapon.instanceId}
                option={option}
                choice={selectedChoice}
                selected={
                  selection.weaponInstanceId === option.weapon.instanceId
                }
                onSelect={() =>
                  setSelection((current) =>
                    selectUpgradeWeapon(current, option.weapon.instanceId),
                  )
                }
              />
            ))}
          </div>
        )}

        {decision.stage === 'SLOT' && decision.selectedWeapon && (
          <div className="upgrade-slot-grid" aria-label="Module Slots">
            {decision.selectedWeapon.moduleSlots.map((slot) =>
              slot ? (
                <ModuleSlotButton
                  key={slot.slotIndex}
                  slot={slot}
                  selected={selection.replacedSlotIndex === slot.slotIndex}
                  onSelect={() =>
                    setSelection((current) =>
                      selectUpgradeSlot(current, slot.slotIndex),
                    )
                  }
                />
              ) : null,
            )}
          </div>
        )}

        {decision.stage === 'CONFIRM' &&
          decision.selectedChoice &&
          decision.operation && (
            <OperationDiff
              choice={decision.selectedChoice}
              operation={decision.operation}
            />
          )}
      </div>

      {recoverableError && (
        <p className="upgrade-screen__error" role="alert">
          <span>RUNTIME REJECTED</span> {recoverableError}
        </p>
      )}

      <footer className="upgrade-screen__actions">
        <button
          className="upgrade-back-button"
          type="button"
          disabled={selection.choiceId === null}
          onClick={handleBack}
        >
          <span aria-hidden="true">←</span> Back / Esc
        </button>
        <span>Keyboard: 1–3 select / Tab navigate / Enter confirm</span>
        <button
          className="upgrade-commit-button"
          type="button"
          disabled={!decision.command}
          data-testid="upgrade-commit"
          onClick={() => decision.command && onCommit(decision.command)}
        >
          Authorize compile <span aria-hidden="true">↗</span>
        </button>
      </footer>
    </section>
  )
}
