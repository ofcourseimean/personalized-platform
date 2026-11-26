import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createSeedLibrary } from '../../domain/seed'
import { useLibraryStore } from '../../state/useLibraryStore'
import { SettingsView } from './SettingsView'

vi.mock('../../infrastructure/libraryRepository', () => ({ libraryRepository: { save: vi.fn(async () => {}) } }))

beforeEach(() => {
  localStorage.clear()
  const data = createSeedLibrary()
  data.companion.browser = { enabled: true, backend: 'managed', sites: [] }
  useLibraryStore.setState({ data })
})

it('finds website setup directly and remembers the chosen section', () => {
  const view = render(<SettingsView />)
  expect(within(screen.getByRole('navigation', { name: '设置分类' })).getAllByRole('button')).toHaveLength(5)
  fireEvent.change(screen.getByRole('textbox', { name: '查找设置' }), { target: { value: 'B 站创作者动态' } })
  fireEvent.click(screen.getByRole('button', { name: '浏览器' }))
  expect(screen.getByRole('heading', { name: '常用网站' })).toBeVisible()
  expect(screen.getByRole('button', { name: '添加 B 站' })).toBeVisible()
  view.unmount()
  render(<SettingsView />)
  expect(screen.getByRole('heading', { name: '浏览器' })).toBeVisible()
})

it('opens an old saved category and can switch between sync and backups', async () => {
  localStorage.setItem('yiyu.settings.activeTab', 'intelligence')
  render(<SettingsView />)
  expect(screen.getByRole('heading', { name: '模型服务' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '数据与同步' }))
  expect(screen.getByRole('heading', { name: '让一隅，随你同行' })).toBeVisible()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '数据管理' })) })
  expect(screen.getByRole('heading', { name: '备份与完整恢复' })).toBeVisible()
})
