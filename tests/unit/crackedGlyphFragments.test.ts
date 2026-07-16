import assert from 'node:assert/strict'
import test from 'node:test'
import { createCrackedGlyphFragmentLayout } from '../../src/game/rendering/crackedGlyphFragments.ts'
import { getPrintableAsciiGlyphFrame } from '../../src/game/glyph/glyphFrame.ts'

test('prepares three reusable atlas fragments for broad glyphs', () => {
  const fragments = createCrackedGlyphFragmentLayout(
    getPrintableAsciiGlyphFrame('M'),
  )

  assert.equal(fragments.length, 3)
  assert.equal(
    fragments.reduce((height, fragment) => height + fragment.height, 0),
    64,
  )
  assert.equal(
    fragments.every(
      ({ x, y, width, height }) =>
        x >= 0 && y >= 0 && x + width <= 64 && y + height <= 64,
    ),
    true,
  )
})

test('uses a validated two-fragment fallback for thin glyphs', () => {
  const first = createCrackedGlyphFragmentLayout(
    getPrintableAsciiGlyphFrame('!'),
  )
  const second = createCrackedGlyphFragmentLayout(
    getPrintableAsciiGlyphFrame('!'),
  )

  assert.equal(first.length, 2)
  assert.deepEqual(first, second)
  assert.equal(Object.isFrozen(first), true)
  assert.equal(first.every((fragment) => Object.isFrozen(fragment)), true)
})
