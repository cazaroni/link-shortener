/** A "nice" integer tick scale for counts: 0 .. top, 3-5 gridlines, never fractional. */
export function niceTicks(max: number, target = 4): number[] {
  const safeMax = Math.max(1, Math.ceil(max))
  const rough = safeMax / target
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  const step = Math.max(1, factor * magnitude)
  const ticks: number[] = []
  for (let value = 0; value < safeMax + step; value += step) {
    ticks.push(value)
    if (value >= safeMax) break
  }
  return ticks
}

/** Compact tick label: 950, 1.2K, 12K, 3.4M. */
export function formatTick(value: number): string {
  if (value < 10_000) return value.toLocaleString()
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** `count` indexes spread evenly from first to last (inclusive), without duplicates. */
export function spreadIndexes(length: number, count: number): number[] {
  if (length <= 0) return []
  if (length <= count || count < 2) return count < 2 ? [0] : Array.from({ length }, (_, i) => i)
  const indexes = new Set<number>()
  for (let i = 0; i < count; i++) indexes.add(Math.round((i * (length - 1)) / (count - 1)))
  return [...indexes]
}
