interface Positioned {
  readonly x: number
  readonly y: number
}

export interface SpatialHash<T extends Positioned> {
  clear(): void
  insert(item: T): void
  queryCircle(x: number, y: number, radius: number, output: T[]): T[]
}

export function createSpatialHash<T extends Positioned>(
  cellSize: number,
): SpatialHash<T> {
  const buckets = new Map<number, T[]>()
  const recycledBuckets: T[][] = []
  const CELL_KEY_STRIDE = 65_536

  function getCellCoordinate(value: number): number {
    return Math.floor(value / cellSize)
  }

  function getCellKey(cellX: number, cellY: number): number {
    return cellX * CELL_KEY_STRIDE + cellY
  }

  return {
    clear() {
      buckets.forEach((bucket) => {
        bucket.length = 0
        recycledBuckets.push(bucket)
      })
      buckets.clear()
    },

    insert(item) {
      const key = getCellKey(
        getCellCoordinate(item.x),
        getCellCoordinate(item.y),
      )
      let bucket = buckets.get(key)

      if (!bucket) {
        bucket = recycledBuckets.pop() ?? []
        buckets.set(key, bucket)
      }

      bucket.push(item)
    },

    queryCircle(x, y, radius, output) {
      output.length = 0
      const minCellX = getCellCoordinate(x - radius)
      const maxCellX = getCellCoordinate(x + radius)
      const minCellY = getCellCoordinate(y - radius)
      const maxCellY = getCellCoordinate(y + radius)

      for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
          const bucket = buckets.get(getCellKey(cellX, cellY))

          if (bucket) {
            output.push(...bucket)
          }
        }
      }

      return output
    },
  }
}
