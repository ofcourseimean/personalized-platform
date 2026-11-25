import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { HomeMoodCard } from './HomeMoodCard'
import { moodOptions } from './moodConfig'
import { moodKinds } from '../../domain/moods'
import { createSeedLibrary, normalizeLibrary } from '../../domain/seed'
import { useLibraryStore } from '../../state/useLibraryStore'
import { createCompanionToolRegistry } from '../companion/agent/tools'
import { expandMoodPoints, moodSummary, moodGradientStyle } from './moodUtils'
import { reflectionDays, emotionDistribution } from './visualizations/reflectionData'

vi.mock('../../infrastructure/libraryRepository',()=>({libraryRepository:{save:vi.fn().mockResolvedValue(undefined)}}))
beforeEach(()=>{useLibraryStore.setState({data:createSeedLibrary()})})

it('replaces the note field with three balanced rows while still requiring exactly five points',()=>{
  const save=vi.fn()
  render(<HomeMoodCard date="2026-10-14" entries={[]} onSave={save} onDelete={vi.fn()}/> )
  fireEvent.click(screen.getAllByRole('button',{name:'记录'})[0])
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(moodOptions.map(item=>item.id)).toEqual(moodKinds)
  expect(moodOptions.map(item=>item.label)).toEqual(['开心','满足','期待','轻松','放松','平静','无聊','迷茫','不安','空落','疲惫','孤独','难过','悲伤','委屈','焦虑','烦躁','生气'])
  expect(screen.queryByRole('button',{name:'感激'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'厌恶'})).not.toBeInTheDocument()
  for(const name of ['无聊','悲伤','不安','无聊','悲伤'])fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${name}`)}))
  fireEvent.click(screen.getByRole('button',{name:'保存五点心情'}))
  expect(save).toHaveBeenCalledWith({date:'2026-10-14',period:'morning',points:{bored:2,sorrowful:2,uneasy:1}})
  const tool = createCompanionToolRegistry().lookup('mood.save')!.definition
  expect(tool.inputSchema.properties).not.toHaveProperty('note')
  expect(tool.description).toContain('sorrowful（悲伤）')
  expect(tool.description).not.toMatch(/grateful|disgusted/)
})
it('retains all new points on reload and old notes on editing without accepting new notes',()=>{
  const store=useLibraryStore.getState()
  store.saveMoodEntry({date:'2026-10-14',period:'morning',points:{lost:1,lighthearted:1,uneasy:1,bored:1,sorrowful:1},note:'不再写入'})
  let library=normalizeLibrary(JSON.parse(JSON.stringify(useLibraryStore.getState().data)))
  expect(library.planner.moodEntries[0].points).toEqual({lost:1,lighthearted:1,uneasy:1,bored:1,sorrowful:1})
  expect(library.planner.moodEntries[0].note).toBeUndefined()
  library.planner.moodEntries[0].note='历史备注'
  useLibraryStore.setState({data:library})
  store.saveMoodEntry({date:'2026-10-14',period:'morning',points:{wronged:5}})
  library=normalizeLibrary(JSON.parse(JSON.stringify(useLibraryStore.getState().data)))
  expect(library.planner.moodEntries[0].note).toBe('历史备注')
  expect(library.planner.moodEntries[0].points).toEqual({wronged:5})
})

it.each([
  ['secure', '安心', '#9cbbb4'],
  ['grateful', '感激', '#ce9a94'],
  ['disgusted', '厌恶', '#627142'],
] as const)('keeps retired %s points meaningful in reload, editing, ribbons and bubbles',(kind, label, color)=>{
  const library=createSeedLibrary()
  library.planner.moodEntries=[{id:'old-mood',date:'2026-10-13',period:'morning',points:{[kind]:5},createdAt:'',updatedAt:''}]
  const entry=normalizeLibrary(JSON.parse(JSON.stringify(library))).planner.moodEntries[0]
  expect(entry.points).toEqual({[kind]:5})
  expect(expandMoodPoints(entry.points)).toEqual(Array(5).fill(kind))
  expect(moodSummary(entry.points)).toBe(`${label} 5`)
  expect(moodGradientStyle(entry.points).background).toBe(color)
  const days=reflectionDays([entry.date],[entry])
  expect(days[0].total).toBe(5)
  expect(emotionDistribution(days).find(mood=>mood.id===kind)).toMatchObject({label,points:5})
  expect(emotionDistribution(days).find(mood=>mood.id==='bored')!.points).toBe(0)
  expect(moodOptions.some(mood=>mood.id===kind)).toBe(false)
})
