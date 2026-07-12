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
  const buckets = new Map<string, T[]>()
  const recycledBuckets: T[][] = []

  function getCellCoordinate(value: number): number {
    return Math.floor(value / cellSize)
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
      const key = `${getCellCoordinate(item.x)},${getCellCoordinate(item.y)}`
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
          const bucket = buckets.get(`${cellX},${cellY}`)

          if (bucket) {
            output.push(...bucket)
          }
        }
      }

      return output
    },
  }
}
