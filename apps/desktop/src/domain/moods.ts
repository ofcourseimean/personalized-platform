import type { MoodKind } from './models'

export const moodKinds: MoodKind[] = [
  'happy', 'satisfied', 'hopeful', 'lighthearted', 'relaxed', 'calm',
  'bored', 'lost', 'uneasy', 'empty', 'tired', 'lonely',
  'sad', 'sorrowful', 'wronged', 'anxious', 'irritated', 'angry',
]

export const retiredMoodKinds = ['secure', 'grateful', 'disgusted'] as const
const storedMoodKinds = new Set<string>([...moodKinds, ...retiredMoodKinds])
export const isStoredMoodKind = (value: unknown): value is MoodKind => typeof value === 'string' && storedMoodKinds.has(value)
