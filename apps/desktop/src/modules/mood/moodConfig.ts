import type { MoodKind, MoodPeriod } from '../../domain/models'
import { moodKinds, retiredMoodKinds } from '../../domain/moods'

const definitions: { id: MoodKind; label: string; color: string; ink: string }[] = [
  { id: 'happy', label: '开心', color: '#e1b84f', ink: '#433711' },
  { id: 'satisfied', label: '满足', color: '#d4a978', ink: '#463522' },
  { id: 'hopeful', label: '期待', color: '#6ead91', ink: '#17382d' },
  { id: 'grateful', label: '感激', color: '#ce9a94', ink: '#432723' },
  { id: 'lighthearted', label: '轻松', color: '#b3cc94', ink: '#293821' },
  { id: 'relaxed', label: '放松', color: '#78abb2', ink: '#17383d' },
  { id: 'calm', label: '平静', color: '#91b5a3', ink: '#233a30' },
  { id: 'bored', label: '无聊', color: '#b5a58b', ink: '#332e26' },
  { id: 'disgusted', label: '厌恶', color: '#627142', ink: '#ffffff' },
  { id: 'lost', label: '迷茫', color: '#9992ae', ink: '#252136' },
  { id: 'uneasy', label: '不安', color: '#a68196', ink: '#33232e' },
  { id: 'empty', label: '空落', color: '#787888', ink: '#ffffff' },
  { id: 'tired', label: '疲惫', color: '#8e8780', ink: '#ffffff' },
  { id: 'lonely', label: '孤独', color: '#737a94', ink: '#ffffff' },
  { id: 'sad', label: '难过', color: '#6d8ba5', ink: '#ffffff' },
  { id: 'sorrowful', label: '悲伤', color: '#586684', ink: '#ffffff' },
  { id: 'wronged', label: '委屈', color: '#8e647c', ink: '#ffffff' },
  { id: 'anxious', label: '焦虑', color: '#8a77a3', ink: '#ffffff' },
  { id: 'irritated', label: '烦躁', color: '#be744d', ink: '#ffffff' },
  { id: 'angry', label: '生气', color: '#b65358', ink: '#ffffff' },
  { id: 'secure', label: '安心', color: '#9cbbb4', ink: '#233a30' },
]

export const moodByKind = Object.fromEntries(definitions.map((mood) => [mood.id, mood])) as Record<MoodKind, typeof definitions[number]>
export const moodOptions = moodKinds.map((kind) => moodByKind[kind])
export const moodCatalog = [...moodOptions, ...retiredMoodKinds.map((kind) => moodByKind[kind])]

export const moodPeriods: { id: MoodPeriod; label: string; range: string }[] = [
  { id: 'morning', label: '早上', range: '起床后' },
  { id: 'afternoon', label: '下午', range: '午后' },
  { id: 'evening', label: '晚上', range: '入睡前' },
]

export const moodPeriodById = Object.fromEntries(moodPeriods.map((period) => [period.id, period])) as Record<MoodPeriod, typeof moodPeriods[number]>

export const currentMoodPeriod = (): MoodPeriod => {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}
