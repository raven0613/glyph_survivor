import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type {
  UiModifierChoice,
} from '../../game/bridge/uiSnapshot.ts'
import type { RunModifierOfferOrigin } from '../../game/runtime/runModifierState.ts'
import './ModifierRewardScreen.scss'

interface ModifierRewardScreenProps {
  readonly offerId: string
  readonly origin: RunModifierOfferOrigin
  readonly choices: readonly Readonly<UiModifierChoice>[]
  readonly recoverableError: string | null
  readonly onCommit: (offerId: string, choiceId: string) => void
}

export function ModifierRewardScreen({
  offerId,
  origin,
  choices,
  recoverableError,
  onCommit,
}: ModifierRewardScreenProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  const firstChoiceRef = useRef<HTMLButtonElement>(null)
  const selectedChoice = choices.find(({ id }) => id === selectedChoiceId)
  const isRunStartTest = origin === 'RUN_START_TEST'

  useEffect(() => {
    firstChoiceRef.current?.focus()
  }, [offerId])

  function commitSelection(): void {
    if (selectedChoice) {
      onCommit(offerId, selectedChoice.id)
    }
  }

  function handleKeyboard(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitSelection()
      return
    }
    const shortcutIndex = Number(event.key) - 1
    if (Number.isInteger(shortcutIndex) && choices[shortcutIndex]) {
      event.preventDefault()
      setSelectedChoiceId(choices[shortcutIndex].id)
    }
  }

  return (
    <section
      className="modifier-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modifier-screen-title"
      onKeyDown={handleKeyboard}
    >
      <header className="modifier-screen__header">
        <span>
          {isRunStartTest ? '// RUN INITIALIZATION' : '// BOSS REWARD'}
        </span>
        <h1 id="modifier-screen-title">Rewrite world rule</h1>
        <p>
          {isRunStartTest
            ? 'Testing gate enabled. Select one rule before simulation begins.'
            : 'Select one rule earned from the defeated Boss.'}
        </p>
      </header>

      <div className="modifier-card-grid" aria-label="Run Modifier choices">
        {choices.map((choice, index) => {
          const isSelected = choice.id === selectedChoice?.id
          return (
            <button
              ref={index === 0 ? firstChoiceRef : undefined}
              className={`modifier-card${
                isSelected ? ' modifier-card--selected' : ''
              }`}
              type="button"
              key={choice.id}
              aria-pressed={isSelected}
              onClick={() => setSelectedChoiceId(choice.id)}
            >
              <span className="modifier-card__index">
                [{String(index + 1).padStart(2, '0')}]
              </span>
              <span className="modifier-card__glyph" aria-hidden="true">
                {choice.identityGlyph}
              </span>
              <strong>{choice.title}</strong>
              <span>{choice.description}</span>
            </button>
          )
        })}
      </div>

      <footer className="modifier-screen__footer">
        <span role="status">
          {recoverableError ??
            (selectedChoice
              ? `${selectedChoice.title} selected.`
              : 'Choose with 1–3, then press Enter.')}
        </span>
        <button type="button" disabled={!selectedChoice} onClick={commitSelection}>
          Commit rule <span aria-hidden="true">↗</span>
        </button>
      </footer>
    </section>
  )
}
