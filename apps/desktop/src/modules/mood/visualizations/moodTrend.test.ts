import { describe, expect, it } from 'vitest'
import type { MoodEntry, MoodPeriod, MoodPoints } from '../../../domain/models'
import { moodTrend } from './moodTrend'
import { moodTrendScale } from './moodTrendScale'

function entry(date: string, period: MoodPeriod, points: MoodPoints, updatedAt = `${date}T12:00:00Z`): MoodEntry {
  return { id: `${date}-${period}`, date, period, points, createdAt: updatedAt, updatedAt }
}

describe('mood trend', () => {
  it('weights each allocation and averages the recorded periods before rounding', () => {
    const first = '2026-11-01'
    const second = '2026-11-02'
    const trend = moodTrend([first, second], [
      entry(first, 'morning', { lighthearted: 3, uneasy: 2 }),
      entry(second, 'morning', { bored: 5 }),
      entry(second, 'afternoon', { sorrowful: 5 }),
      entry(second, 'evening', { calm: 5 }),
    ])

    expect(trend[0]).toMatchObject({ periods: 1, averageDays: 1 })
    expect(trend[0].score).toBeCloseTo(57.7667)
    expect(trend[1].periods).toBe(3)
    expect(trend[1].score).toBeCloseTo(40.1111)
  })

  it('uses the previous six calendar days across the view boundary and leaves gaps', () => {
    const first = '2026-11-01'
    const trend = moodTrend([first, '2026-11-02', '2026-11-03'], [
      entry('2026-10-25', 'morning', { happy: 5 }),
      entry('2026-10-26', 'morning', { bored: 5 }),
      entry(first, 'morning', { sorrowful: 5 }),
      entry('2026-11-03', 'morning', { calm: 5 }),
    ])

    expect(trend[0].score).toBeCloseTo(22)
    expect(trend[0].averageDays).toBe(2)
    expect(trend[0].average).toBeCloseTo(28)
    expect(trend[1]).toEqual({ date: '2026-11-02', score: null, periods: 0, entries: [], average: null, averageDays: 0 })
    expect(trend[2].averageDays).toBe(2)
    expect(trend[2].average).toBeCloseTo(43.1667)
  })

  it('includes retired emotions and counts one entry per time period', () => {
    const date = '2026-11-01'
    const input = [
      entry(date, 'morning', { grateful: 5 }, `${date}T13:00:00Z`),
      entry(date, 'morning', { happy: 5 }),
      entry(date, 'afternoon', { disgusted: 5 }),
      entry(date, 'evening', { secure: 5 }),
    ]
    const before = structuredClone(input)
    const [day] = moodTrend([date], input)

    expect(day.periods).toBe(3)
    expect(day.score).toBeCloseTo(58.8333)
    expect(day.entries).toEqual([input[0], input[2], input[3]])
    expect(input).toEqual(before)
  })
})

describe('mood trend scale', () => {
  it('makes variation around 40–50 legible with padded, evenly spaced ticks', () => {
    expect(moodTrendScale([40, 44.1, 46.9, 50])).toEqual({ min: 35, max: 55, ticks: [55, 50, 45, 40, 35] })
  })

  it('keeps a readable scale for a flat series and bounds the full score range', () => {
    expect(moodTrendScale([46, 46])).toEqual({ min: 35, max: 55, ticks: [55, 50, 45, 40, 35] })
    expect(moodTrendScale([0, 100])).toEqual({ min: 0, max: 100, ticks: [100, 80, 60, 40, 20, 0] })
  })
})
