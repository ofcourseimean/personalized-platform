import { formatLocalDate } from '../../../domain/localDate'
import type { MoodEntry, MoodKind, MoodPeriod, MoodPoints } from '../../../domain/models'

// Chinese word valence norms, on the original −3 to +3 scale.
// https://doi.org/10.1007/s10936-023-10018-9 (supplement: figshare.20209859)
// https://doi.org/10.3758/s13428-021-01607-4
const valence: Record<MoodKind, number> = {
  happy: 2.32,
  satisfied: 1.74,
  hopeful: 1.68,
  lighthearted: 1.71,
  relaxed: 1.79,
  calm: 0.86,
  bored: -0.96,
  lost: -1.05, // 茫然 is the closest rated word.
  uneasy: -1.4,
  empty: -1.32, // 空虚 is the closest rated word.
  tired: -1.61,
  lonely: -1.23,
  sad: -1.5,
  sorrowful: -1.68,
  wronged: -1.86,
  anxious: -1.54,
  irritated: -1.71,
  angry: -1.59,
  secure: 1.5,
  grateful: 1.93,
  disgusted: -1.84,
}

export interface MoodTrendDay {
  date: string
  score: number | null
  periods: number
  average: number | null
  averageDays: number
}

function periodScore(points: MoodPoints) {
  let total = 0
  let weighted = 0
  for (const [kind, count] of Object.entries(points)) {
    const weight = valence[kind as MoodKind]
    if (!Number.isFinite(weight) || !Number.isFinite(count) || count <= 0) continue
    total += count
    weighted += count * weight
  }
  return total > 0 ? 50 + (weighted / total) * (50 / 3) : null
}

export function moodTrend(dates: string[], entries: MoodEntry[]): MoodTrendDay[] {
  if (!dates.length) return []
  const windowStart = new Date(`${dates[0]}T12:00:00`)
  windowStart.setDate(windowStart.getDate() - 6)
  const firstDate = formatLocalDate(windowStart)
  const lastDate = dates.at(-1)!

  const entriesByDay = new Map<string, Map<MoodPeriod, MoodEntry>>()
  for (const entry of entries) {
    if (entry.date < firstDate || entry.date > lastDate) continue
    const day = entriesByDay.get(entry.date) ?? new Map<MoodPeriod, MoodEntry>()
    const existing = day.get(entry.period)
    if (!existing || existing.updatedAt <= entry.updatedAt) day.set(entry.period, entry)
    entriesByDay.set(entry.date, day)
  }

  const scores = new Map<string, { score: number; periods: number }>()
  for (const [date, day] of entriesByDay) {
    const periods = [...day.values()].map((entry) => periodScore(entry.points)).filter((score) => score !== null)
    if (periods.length) {
      scores.set(date, { score: periods.reduce((total, score) => total + score, 0) / periods.length, periods: periods.length })
    }
  }

  return dates.map((date) => {
    const day = scores.get(date)
    if (!day) return { date, score: null, periods: 0, average: null, averageDays: 0 }

    const cursor = new Date(`${date}T12:00:00`)
    const recent: number[] = []
    for (let offset = 0; offset < 7; offset += 1) {
      const observed = scores.get(formatLocalDate(cursor))
      if (observed) recent.push(observed.score)
      cursor.setDate(cursor.getDate() - 1)
    }
    return {
      date,
      ...day,
      average: recent.reduce((total, score) => total + score, 0) / recent.length,
      averageDays: recent.length,
    }
  })
}
