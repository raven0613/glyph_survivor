import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatGameplayDuration,
  formatMetricNumber,
  formatModuleRank,
} from '../../src/app/screens/runResultPresentation.ts'

test('formats gameplay duration without counting partial future seconds', () => {
  assert.equal(formatGameplayDuration(0), '00:00')
  assert.equal(formatGameplayDuration(65_999), '01:05')
  assert.equal(formatGameplayDuration(3_661_000), '01:01:01')
})

test('formats result metrics and preserves unavailable DPS', () => {
  assert.equal(formatMetricNumber(1_234.567), '1,234.57')
  assert.equal(formatMetricNumber(0), '0')
  assert.equal(formatMetricNumber(null), '—')
})

test('formats Module Rank independently from weapon progression', () => {
  assert.equal(formatModuleRank(1), 'I')
  assert.equal(formatModuleRank(3), 'III')
  assert.equal(formatModuleRank(8), '8')
})
