import { useState } from 'react'
import type { UiInitialWeaponChoice } from '../../game/bridge/uiSnapshot.ts'

interface InitialWeaponScreenProps {
  readonly choices: readonly Readonly<UiInitialWeaponChoice>[]
  readonly onConfirm: (definitionId: string) => void
}

export function InitialWeaponScreen({
  choices,
  onConfirm,
}: InitialWeaponScreenProps) {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<
    string | null
  >(null)
  const validSelectedDefinitionId = choices.some(
    (choice) => choice.definitionId === selectedDefinitionId,
  )
    ? selectedDefinitionId
    : null

  function confirmSelection(): void {
    if (validSelectedDefinitionId) {
      onConfirm(validSelectedDefinitionId)
    }
  }

  return (
    <section
      className="initial-weapon-screen"
      aria-labelledby="initial-weapon-title"
    >
      <div className="initial-weapon-screen__heading">
        <p>Run initialization / 01</p>
        <h1 id="initial-weapon-title">Select initial weapon</h1>
        <p>Choose one unlocked weapon to bind to this run.</p>
      </div>

      <div className="weapon-choice-grid" aria-label="Unlocked weapons">
        {choices.map((choice, index) => {
          const isSelected =
            choice.definitionId === validSelectedDefinitionId

          return (
            <button
              className={`weapon-choice-card${
                isSelected ? ' weapon-choice-card--selected' : ''
              }`}
              type="button"
              key={choice.definitionId}
              aria-pressed={isSelected}
              onClick={() => setSelectedDefinitionId(choice.definitionId)}
            >
              <span className="weapon-choice-card__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="weapon-choice-card__glyph" aria-hidden="true">
                {choice.identityGlyph}
              </span>
              <span className="weapon-choice-card__title">{choice.title}</span>
              <span className="weapon-choice-card__description">
                {choice.description}
              </span>
              <span className="weapon-choice-card__slots">
                Module slots / {choice.moduleSlotCount}
              </span>
            </button>
          )
        })}
      </div>

      <div className="initial-weapon-screen__actions">
        <span aria-live="polite">
          {validSelectedDefinitionId
            ? 'Weapon selected. Ready to deploy.'
            : 'Select a weapon card to continue.'}
        </span>
        <button
          className="deploy-button"
          type="button"
          disabled={!validSelectedDefinitionId}
          onClick={confirmSelection}
        >
          Start run <span aria-hidden="true">↗</span>
        </button>
      </div>
    </section>
  )
}

