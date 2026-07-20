import { Assets } from 'pixi.js'
import type { PreparedGlyphFontBanks } from '../content/visuals/glyphFontBanks.ts'

export interface GlyphFontLoadRequest {
  readonly assetId: string
  readonly src: string
  readonly family: string
  readonly weight: string
}

export interface LoadedGlyphFontFace {
  readonly family: string
  readonly status: string
}

type LoadGlyphFont = (
  request: Readonly<GlyphFontLoadRequest>,
) => Promise<readonly Readonly<LoadedGlyphFontFace>[]>

export interface LoadRequiredGlyphFontsOptions {
  readonly fontBanks: PreparedGlyphFontBanks
  readonly assetUrlById: Readonly<Record<string, string>>
  readonly signal?: AbortSignal
  readonly loadFont?: LoadGlyphFont
}

function createAbortError(): Error {
  const error = new Error('Glyph font loading was aborted.')
  error.name = 'AbortError'
  return error
}

function normalizeCssFontFamilySerialization(family: string): string {
  const trimmedFamily = family.trim()
  const openingQuote = trimmedFamily[0]
  const closingQuote = trimmedFamily[trimmedFamily.length - 1]
  if (
    (openingQuote === '"' || openingQuote === "'") &&
    closingQuote === openingQuote
  ) {
    return trimmedFamily.slice(1, -1)
  }
  return trimmedFamily
}

function isMatchingFontFamily(
  loadedFamily: string,
  expectedFamily: string,
): boolean {
  return (
    normalizeCssFontFamilySerialization(loadedFamily) ===
    normalizeCssFontFamilySerialization(expectedFamily)
  )
}

async function loadPixiFont(
  request: Readonly<GlyphFontLoadRequest>,
): Promise<readonly Readonly<LoadedGlyphFontFace>[]> {
  const loaded = await Assets.load<
    LoadedGlyphFontFace | LoadedGlyphFontFace[]
  >({
    alias: request.assetId,
    src: request.src,
    data: {
      family: request.family,
      weights: [request.weight],
    },
  })
  return Object.freeze(Array.isArray(loaded) ? loaded : [loaded])
}

export async function loadRequiredGlyphFonts({
  fontBanks,
  assetUrlById,
  signal,
  loadFont = loadPixiFont,
}: LoadRequiredGlyphFontsOptions): Promise<void> {
  for (const bank of fontBanks.ordered) {
    if (bank.assetId === null) {
      continue
    }
    if (signal?.aborted) {
      throw createAbortError()
    }
    const src = assetUrlById[bank.assetId]
    if (!src) {
      throw new Error(`Missing font asset URL for ${bank.assetId}.`)
    }
    const faces = await loadFont({
      assetId: bank.assetId,
      src,
      family: bank.family,
      weight: bank.weight,
    })
    if (faces.length === 0) {
      throw new Error(`Font loader returned no faces for ${bank.assetId}.`)
    }
    const invalidStatusFace = faces.find((face) => face.status !== 'loaded')
    if (invalidStatusFace) {
      throw new Error(
        `Font ${bank.assetId} returned status ${invalidStatusFace.status}.`,
      )
    }
    const mismatchedFamilyFace = faces.find(
      (face) => !isMatchingFontFamily(face.family, bank.family),
    )
    if (mismatchedFamilyFace) {
      throw new Error(
        `Loaded font family ${mismatchedFamilyFace.family} for ${bank.assetId} did not match ${bank.family}.`,
      )
    }
  }
  if (signal?.aborted) {
    throw createAbortError()
  }
}
