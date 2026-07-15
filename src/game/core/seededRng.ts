export interface SeededRng {
  next(): number
}

export function hashSeed(seed: string | number): number {
  const input = String(seed)
  let hash = 2_166_136_261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

export function createSeededRng(seed: string | number): SeededRng {
  let state = hashSeed(seed)

  return Object.freeze({
    next() {
      state += 0x6d2b79f5
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
    },
  })
}
