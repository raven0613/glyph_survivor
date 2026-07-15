import './DeathReviewPrompt.scss'

interface DeathReviewPromptProps {
  readonly onEnterRunResult: () => void
}

export function DeathReviewPrompt({
  onEnterRunResult,
}: DeathReviewPromptProps) {
  return (
    <aside className="death-review-prompt" aria-live="polite">
      <span aria-hidden="true">DEATH_REVIEW / CAPTURE READY</span>
      <button type="button" onClick={onEnterRunResult}>
        進入結算 <span aria-hidden="true">→</span>
      </button>
    </aside>
  )
}
