const METRIC_NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

const MODULE_RANK_LABELS = Object.freeze(['0', 'I', 'II', 'III', 'IV', 'V'])

export function formatGameplayDuration(durationMs: number): string {
  const totalSeconds = Math.floor(Math.max(0, durationMs) / 1_000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  const minuteAndSecond = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${minuteAndSecond}`
    : minuteAndSecond
}

export function formatMetricNumber(value: number | null): string {
  return value === null ? '—' : METRIC_NUMBER_FORMATTER.format(value)
}

export function formatModuleRank(rank: number): string {
  return MODULE_RANK_LABELS[rank] ?? String(rank)
}
