import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSeedLibrary } from '../../../domain/seed'
import { bilibiliCreatorSites } from '../../../domain/browser'
import { useLibraryStore } from '../../../state/useLibraryStore'
import { sendCompanionTurn } from '../../companion/companionConversation'
import { forgetBrowserTurn } from '../taskSession'
import type { AgentModelRequest } from '../../companion/agent/types'

const calls = vi.hoisted(() => ({ native: vi.fn(), generate: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: calls.native }))
vi.mock('../../../infrastructure/companionProvider', () => ({
  createCompanionProvider: () => ({ id: 'deepseek', generate: calls.generate, testConnection: async () => '' }),
}))
vi.mock('../../../infrastructure/libraryRepository', () => ({ libraryRepository: { save: vi.fn(async () => {}) } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('__TAURI_INTERNALS__', {})
  forgetBrowserTurn('main:private')
  const data = createSeedLibrary()
  data.companion.provider.providerId = 'deepseek'
  data.companion.permissions.internet = true
  data.settings.trust.externalAiProcessing = true
  data.companion.browser = { enabled: true, backend: 'managed', sites: ['https://www.bilibili.com', ...bilibiliCreatorSites], semanticRouting: true }
  useLibraryStore.setState({ data })
})
afterEach(() => vi.unstubAllGlobals())

it('sends the exact screenshot request to the native browser and renders the verified post locally', async () => {
  calls.native.mockImplementation(async (command, args) => {
    if (command === 'managed_browser_configure') return { epoch: 7 }
    expect(command).toBe('managed_browser_creator_activity')
    expect(args).toEqual({ name: '天才美少女卡莎', expectedEpoch: 7 })
    return { verified: true, data: { status: 'found', name: args.name, profileUrl: 'https://space.bilibili.com/42/dynamic', text: '测试动态正文', published: '2小时前' } }
  })
  expect(await sendCompanionTurn('天才美少女卡莎最新一条动态是啥')).toContain('测试动态正文')
  expect(calls.native.mock.calls.map(([name]) => name)).toEqual(['managed_browser_configure', 'managed_browser_creator_activity'])
  expect(calls.generate).not.toHaveBeenCalled()
  expect(JSON.stringify(useLibraryStore.getState().data.companion.messages)).not.toContain('测试动态正文')
})

it('stops with the targeted authorization text rather than substituting public search', async () => {
  useLibraryStore.getState().setCompanionBrowser({ sites: ['https://www.bilibili.com', bilibiliCreatorSites[0]] })
  expect(await sendCompanionTurn('天才美少女卡莎最新一条动态是啥')).toContain('B 站创作者动态')
  expect(calls.native).not.toHaveBeenCalled()
  expect(calls.generate).not.toHaveBeenCalled()
})

it('can verify the requested creator directly from a supplied official space link', async () => {
  useLibraryStore.getState().setCompanionBrowser({ sites: [bilibiliCreatorSites[1]] })
  calls.native.mockImplementation(async (command, args) => {
    if (command === 'managed_browser_configure') return { epoch: 7 }
    expect(command).toBe('managed_browser_creator_activity')
    expect(args).toEqual({ uid: '42', expectedEpoch: 7 })
    return { verified: true, data: { status: 'found', name: '页面昵称', profileUrl: 'https://space.bilibili.com/42/dynamic', text: '从这个空间读到的动态', published: '昨天 15:00' } }
  })
  expect(await sendCompanionTurn('查一下这个空间最新一条动态 https://space.bilibili.com/42')).toContain('页面昵称')
  expect(calls.generate).not.toHaveBeenCalled()
})

it.each([false, true])('reads local evidence after searching and navigating to a new tab (page changed: %s)', async (pageChanged) => {
  const origin = 'https://lesson.example.com'
  useLibraryStore.getState().setCompanionBrowser({
    sites: [origin], interactionSites: [origin], semanticRouting: false,
    profiles: [{ origin, label: '测试学堂', role: 'portal' }],
  })
  let stage = 'search'
  let observed = 0
  calls.native.mockImplementation(async (command, args) => {
    if (command === 'managed_browser_configure') return { epoch: 7 }
    const request = args.request
    let data: unknown
    if (request.kind === 'tabs') data = [{ tabId: 3 }]
    else if (request.kind === 'act') {
      expect(request.interaction.operation).toBe(stage === 'search' ? 'search' : 'navigate')
      stage = stage === 'search' ? 'navigate' : 'extract'
      data = { actionStatus: 'dispatched', ...(stage === 'extract' ? { nextTabId: 9 } : {}) }
    } else {
      observed++
      data = {
        origin, tabId: request.tabId, observationId: `obs-${observed}`,
        url: origin + (pageChanged && observed >= 4 ? '/updated-works' : '/works'), title: '课程页',
        text: stage === 'extract' ? '矩阵作业\n截止 12月1日 15:00\n旁人隐私正文' : '目录',
        controls: stage === 'extract' ? [] : [{ id: 'current', operation: stage, name: stage === 'navigate' ? '查看矩阵作业' : '搜索' }],
      }
    }
    return { verified: true, privateBrowser: true, origin, data }
  })
  calls.generate.mockImplementation(async (request: AgentModelRequest) => {
    expect(JSON.stringify(request)).not.toContain('旁人隐私正文')
    const page = JSON.parse(request.messages.findLast(item => item.role === 'tool')!.content).data.data
    const args = { origin, tabId: page.tabId, observationId: page.observationId }
    return stage === 'extract'
      ? { type: 'tool_call', call: { id: `extract-${page.observationId}`, name: 'browser.extract', arguments: { ...args, phrase: '矩阵作业' } } }
      : { type: 'tool_call', call: { id: stage, name: 'browser.act', arguments: { ...args, elementId: 'current', operation: stage, ...(stage === 'search' ? { query: '矩阵作业' } : {}) } } }
  })
  const reply = await sendCompanionTurn('去测试学堂查一下矩阵作业什么时候截止')
  expect(reply).toContain('截止 12月1日 15:00')
  expect(reply).not.toContain('旁人隐私正文')
  expect(calls.generate).toHaveBeenCalledTimes(pageChanged ? 4 : 3)
  const requests = calls.native.mock.calls.filter(([name]) => name === 'managed_browser_request').map(([, { request }]) => request)
  expect(requests.map(request => request.kind)).toEqual([
    'tabs', 'page', 'act', 'observe', 'act', 'observe', 'observe', ...(pageChanged ? ['observe', 'observe'] : []),
  ])
  expect(requests.slice(-2).map(request => request.tabId)).toEqual([9, 9])
})
