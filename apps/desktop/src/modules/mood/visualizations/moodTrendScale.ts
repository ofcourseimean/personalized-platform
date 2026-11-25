export function moodTrendScale(values: number[]) {
  if (!values.length) return { min: 0, max: 100, ticks: [100, 75, 50, 25, 0] }

  const low = Math.min(...values)
  const high = Math.max(...values)
  const center = (low + high) / 2
  const paddedLow = Math.max(0, Math.min(low - 2, center - 7.5))
  const paddedHigh = Math.min(100, Math.max(high + 2, center + 7.5))
  const step = [5, 10, 20, 25].find((interval) =>
    Math.ceil(paddedHigh / interval) - Math.floor(paddedLow / interval) <= 5,
  ) ?? 25
  const min = Math.floor(paddedLow / step) * step
  const max = Math.ceil(paddedHigh / step) * step
  const ticks = Array.from({ length: (max - min) / step + 1 }, (_, index) => max - index * step)

  return { min, max, ticks }
}
