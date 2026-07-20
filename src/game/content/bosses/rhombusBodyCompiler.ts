export interface DigitalDiamondCell {
  readonly column: number
  readonly row: number
}

export interface ReinforcedCluster {
  readonly id: string
  readonly cells: readonly Readonly<DigitalDiamondCell>[]
}

export interface CompileReinforcedClustersInput {
  readonly cells: readonly Readonly<DigitalDiamondCell>[]
  readonly requestedClusterCount: number
  readonly seed: string
}

export interface ReinforcedClusterCompilation {
  readonly clusters: readonly Readonly<ReinforcedCluster>[]
  readonly candidateCount: number
  readonly acceptedCandidateCount: number
  readonly rejectedCandidateCount: number
}

interface ClusterShape {
  readonly id: string
  readonly offsets: readonly (readonly [number, number])[]
}

interface RankedClusterCandidate {
  readonly stableKey: string
  readonly score: number
  readonly cells: readonly Readonly<DigitalDiamondCell>[]
}

const CLUSTER_SHAPES = Object.freeze([
  Object.freeze({ id: 'H2', offsets: Object.freeze([[0, 0], [1, 0]] as const) }),
  Object.freeze({ id: 'V2', offsets: Object.freeze([[0, 0], [0, 1]] as const) }),
  Object.freeze({ id: 'H3', offsets: Object.freeze([[0, 0], [1, 0], [2, 0]] as const) }),
  Object.freeze({ id: 'V3', offsets: Object.freeze([[0, 0], [0, 1], [0, 2]] as const) }),
  Object.freeze({ id: 'L0', offsets: Object.freeze([[0, 0], [1, 0], [0, 1]] as const) }),
  Object.freeze({ id: 'L1', offsets: Object.freeze([[0, 0], [-1, 0], [0, 1]] as const) }),
  Object.freeze({ id: 'L2', offsets: Object.freeze([[0, 0], [1, 0], [0, -1]] as const) }),
  Object.freeze({ id: 'L3', offsets: Object.freeze([[0, 0], [-1, 0], [0, -1]] as const) }),
] as const satisfies readonly ClusterShape[])

const CARDINAL_OFFSETS = Object.freeze([
  Object.freeze([0, -1] as const),
  Object.freeze([1, 0] as const),
  Object.freeze([0, 1] as const),
  Object.freeze([-1, 0] as const),
])

function coordinateKey(column: number, row: number): string {
  return `${column},${row}`
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  return hash >>> 0
}

function validateDiamondCells(
  cells: readonly Readonly<DigitalDiamondCell>[],
): ReadonlySet<string> {
  if (cells.length === 0) {
    throw new Error('Reinforced cluster source cells must not be empty.')
  }
  const keys = new Set<string>()
  for (const cell of cells) {
    if (!Number.isSafeInteger(cell.column) || !Number.isSafeInteger(cell.row)) {
      throw new TypeError('Digital-diamond coordinates must be safe integers.')
    }
    const key = coordinateKey(cell.column, cell.row)
    if (keys.has(key)) {
      throw new Error(`Digital diamond contains duplicate coordinate ${key}.`)
    }
    keys.add(key)
  }
  return keys
}

export function compileDigitalDiamond(
  sideLength: number,
): readonly Readonly<DigitalDiamondCell>[] {
  if (!Number.isSafeInteger(sideLength) || sideLength <= 0) {
    throw new RangeError('Digital diamond side length must be a positive safe integer.')
  }
  const radius = sideLength - 1
  const cells: Readonly<DigitalDiamondCell>[] = []
  for (let row = -radius; row <= radius; row += 1) {
    const halfWidth = radius - Math.abs(row)
    for (let column = -halfWidth; column <= halfWidth; column += 1) {
      cells.push(Object.freeze({ column, row }))
    }
  }
  const expectedCount = sideLength ** 2 + (sideLength - 1) ** 2
  if (cells.length !== expectedCount) {
    throw new Error('Digital diamond compiler violated its cell-count invariant.')
  }
  return Object.freeze(cells)
}

function createRankedCandidates(
  cells: readonly Readonly<DigitalDiamondCell>[],
  cellKeys: ReadonlySet<string>,
  seed: string,
): RankedClusterCandidate[] {
  const maximumRadius = cells.reduce(
    (maximum, cell) => Math.max(maximum, Math.abs(cell.column) + Math.abs(cell.row)),
    0,
  )
  const extremeTips = new Set([
    coordinateKey(0, -maximumRadius),
    coordinateKey(maximumRadius, 0),
    coordinateKey(0, maximumRadius),
    coordinateKey(-maximumRadius, 0),
  ])
  const candidatesByKey = new Map<string, RankedClusterCandidate>()

  for (const origin of cells) {
    for (const shape of CLUSTER_SHAPES) {
      const candidateCells = shape.offsets
        .map(([offsetX, offsetY]) =>
          Object.freeze({
            column: origin.column + offsetX,
            row: origin.row + offsetY,
          }),
        )
        .sort((first, second) => first.row - second.row || first.column - second.column)
      const coordinateKeys = candidateCells.map((cell) =>
        coordinateKey(cell.column, cell.row),
      )
      if (
        coordinateKeys.some(
          (key) => !cellKeys.has(key) || extremeTips.has(key),
        )
      ) {
        continue
      }
      const stableKey = coordinateKeys.join('|')
      if (candidatesByKey.has(stableKey)) {
        continue
      }
      const radialBand = Math.max(
        ...candidateCells.map(
          (cell) => Math.abs(cell.column) + Math.abs(cell.row),
        ),
      )
      const score = stableHash(
        `${seed}:${shape.id}:${stableKey}:band-${radialBand}`,
      )
      candidatesByKey.set(stableKey, {
        stableKey,
        score,
        cells: Object.freeze(candidateCells),
      })
    }
  }

  return [...candidatesByKey.values()].sort(
    (first, second) =>
      first.score - second.score || first.stableKey.localeCompare(second.stableKey),
  )
}

function isSeparatedFromAccepted(
  candidate: RankedClusterCandidate,
  occupiedKeys: ReadonlySet<string>,
): boolean {
  for (const cell of candidate.cells) {
    if (occupiedKeys.has(coordinateKey(cell.column, cell.row))) {
      return false
    }
    for (const [offsetX, offsetY] of CARDINAL_OFFSETS) {
      if (
        occupiedKeys.has(
          coordinateKey(cell.column + offsetX, cell.row + offsetY),
        )
      ) {
        return false
      }
    }
  }
  return true
}

export function compileReinforcedClustersWithDiagnostics({
  cells,
  requestedClusterCount,
  seed,
}: CompileReinforcedClustersInput): Readonly<ReinforcedClusterCompilation> {
  if (
    !Number.isSafeInteger(requestedClusterCount) ||
    requestedClusterCount < 0
  ) {
    throw new RangeError('Reinforced cluster count must be a non-negative safe integer.')
  }
  if (seed.length === 0) {
    throw new TypeError('Reinforced cluster seed must not be empty.')
  }
  const cellKeys = validateDiamondCells(cells)
  const candidates = createRankedCandidates(cells, cellKeys, seed)
  const occupiedKeys = new Set<string>()
  const accepted: Readonly<ReinforcedCluster>[] = []
  let rejectedCandidateCount = 0

  if (requestedClusterCount === 0) {
    return Object.freeze({
      clusters: Object.freeze([]),
      candidateCount: candidates.length,
      acceptedCandidateCount: 0,
      rejectedCandidateCount: 0,
    })
  }

  for (const candidate of candidates) {
    if (!isSeparatedFromAccepted(candidate, occupiedKeys)) {
      rejectedCandidateCount += 1
      continue
    }
    const cluster = Object.freeze({
      id: `reinforced.${accepted.length}`,
      cells: candidate.cells,
    })
    accepted.push(cluster)
    candidate.cells.forEach((cell) =>
      occupiedKeys.add(coordinateKey(cell.column, cell.row)),
    )
    if (accepted.length === requestedClusterCount) {
      return Object.freeze({
        clusters: Object.freeze(accepted),
        candidateCount: candidates.length,
        acceptedCandidateCount: accepted.length,
        rejectedCandidateCount,
      })
    }
  }

  throw new RangeError(
    `Reinforced cluster count ${requestedClusterCount} exceeds the legal prefix of ${accepted.length}.`,
  )
}

export function compileReinforcedClusters(
  input: CompileReinforcedClustersInput,
): readonly Readonly<ReinforcedCluster>[] {
  return compileReinforcedClustersWithDiagnostics(input).clusters
}
