import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeedLibrary } from '../../domain/seed'
import { bilibiliSetupSites, normalizeBrowser } from '../../domain/browser'
import { useLibraryStore } from '../../state/useLibraryStore'
import { sendCompanionTurn } from '../companion/companionConversation'
import type { AgentModelRequest } from '../companion/agent/types'
import { forgetBrowserTurn } from './taskSession'
import { parseSiteDecision } from './semanticSiteRouting'
import { siteDirectory } from './siteDirectory'
import { PublicSiteFlow } from './publicSiteFlow'

const calls = vi.hoisted(() => ({ native: vi.fn(), generate: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: calls.native }))
vi.mock('../../infrastructure/companionProvider', () => ({
  createCompanionProvider: () => ({ id: 'deepseek', generate: calls.generate, testConnection: async () => '' }),
}))
vi.mock('../../infrastructure/libraryRepository', () => ({ libraryRepository: { save: vi.fn(async () => {}) } }))

const courses = 'https://learn.tsinghua.edu.cn'
const rain = 'https://pro.yuketang.cn'
const seats = 'https://seat.lib.tsinghua.edu.cn'
const hltv = 'https://www.hltv.org'
const video = 'https://www.bilibili.com/video/BV1234Abc567/'
const answer = (text: string) => ({ type: 'text', text: JSON.stringify({ version: 1, blocks: [{ type: 'paragraph', text }] }) })
const response = (value: unknown) => ({ type: 'text', text: JSON.stringify(value) })
const tool = (name: string, args: unknown) => ({ type: 'tool_call', call: { id: name, name, arguments: args } })

function setup(sites: string[] = []) {
  const data = createSeedLibrary()
  data.companion.provider.providerId = 'deepseek'
  data.companion.permissions.internet = true
  data.companion.browser = { enabled: true, backend: 'managed', semanticRouting: true, sites }
  data.settings.trust.externalAiProcessing = true
  data.settings.trust.outboundReviewMode = 'balanced'
  useLibraryStore.setState({ data })
  return data
}

function selectSite(origin: string) {
  const browser = useLibraryStore.getState().data.companion.browser!
  return response({ site: siteDirectory(browser).findIndex(card => card.origin === origin) + 1 })
}

function mockUnreadablePage() {
  calls.native.mockImplementation(async (name, args) => {
    if (name === 'managed_browser_configure') return { epoch: 4 }
    expect(name).toBe('managed_browser_request')
    return { verified: true, origin: args.request.origin, data: args.request.kind === 'tabs' ? [{ tabId: 5 }] : { loginState: 'managed_login' } }
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('__TAURI_INTERNALS__', {})
  forgetBrowserTurn('main:private')
  forgetBrowserTurn('main:ordinary')
})
afterEach(() => vi.unstubAllGlobals())

describe('website purpose choices through companion chat', () => {
  it('routes a paraphrase without a site name and keeps names, URLs, history and personal identifiers out of the routing request', async () => {
    const data = setup([courses, rain])
    data.companion.messages = [{ id: 'old', role: 'user', createdAt: new Date().toISOString(), content: 'OLD-CHAT', contextSummary: '' }]
    calls.generate.mockImplementationOnce(async (request: AgentModelRequest) => {
      expect(request.context.page).toBe('site-routing')
      expect(request.tools).toEqual([])
      const outgoing = JSON.stringify(request)
      expect(outgoing).toContain('查找老师上传的资料')
      expect(outgoing).not.toMatch(/learn\.tsinghua|pro\.yuketang|清华网络学堂|OLD-CHAT|route-user@example\.com/u)
      return selectSite(courses)
    })
    mockUnreadablePage()
    await sendCompanionTurn('老师上课说会补发一份 PDF，帮我看看发了没，我的地址是 route-user@example.com')
    const reads = calls.native.mock.calls.filter(([name]) => name === 'managed_browser_request')
    expect(reads.map(([, args]) => args.request.origin)).toEqual([courses, courses])
    expect(calls.generate).toHaveBeenCalledTimes(1)
    expect(useLibraryStore.getState().data.companion.messages).toHaveLength(1)
  })

  it('continues an ambiguous course choice locally from the named reply', async () => {
    const data = setup([courses, rain])
    const candidates = siteDirectory(data.companion.browser!)
    calls.generate.mockResolvedValueOnce(response({ choices: [courses, rain].map(origin => candidates.findIndex(card => card.origin === origin) + 1) }))
    expect(await sendCompanionTurn('那份记录在什么地方')).toContain('「雨课堂」')
    expect(calls.native).not.toHaveBeenCalled()
    mockUnreadablePage()
    await sendCompanionTurn('用雨课堂')
    expect(calls.generate).toHaveBeenCalledTimes(1)
    expect(calls.native.mock.calls[1][1].request.origin).toBe(rain)
  })

  it('proposes a preset but does not authorize it or search another site', async () => {
    setup([courses])
    calls.generate.mockResolvedValueOnce(selectSite(hltv))
    expect(await sendCompanionTurn('Vitality 最近赢过谁')).toContain('请到浏览器连接添加并授权')
    expect(calls.native).not.toHaveBeenCalled()
    expect(useLibraryStore.getState().data.companion.browser!.sites).toEqual([courses])
  })

  it('lets custom descriptions drive routing without new task patterns or host entries', async () => {
    const origin = 'https://workspace.example.com'
    const data = setup([origin])
    data.companion.browser!.profiles = [{ origin, label: '自定义后台', role: 'general', purpose: '家庭项目的能耗数据', abilities: ['按楼层查看每天的耗电量'] }]
    calls.generate.mockImplementationOnce(async (request: AgentModelRequest) => {
      expect(request.messages[0].content).toContain('每天的耗电量')
      expect(request.messages[0].content).not.toContain(origin)
      return selectSite(origin)
    })
    mockUnreadablePage()
    await sendCompanionTurn('昨天二楼用了多少度电')
    expect(calls.native.mock.calls[1][1].request.origin).toBe(origin)
  })

  it('stops before browser access when site permission changes during routing', async () => {
    setup([courses])
    calls.generate.mockImplementationOnce(async () => {
      const picked = selectSite(courses)
      useLibraryStore.getState().setCompanionBrowser({ sites: [] })
      return picked
    })
    await expect(sendCompanionTurn('老师的新 PDF 发了没')).rejects.toThrow('设置已变化')
    expect(calls.native).not.toHaveBeenCalled()
  })

  it('honors explicit review and never falls through after refusal', async () => {
    const data = setup([courses])
    data.companion.browser!.confirmQueryEgress = true
    const requestPrivacyReview = vi.fn(async () => false)
    await expect(sendCompanionTurn('老师的新 PDF 发了没', { requestPrivacyReview })).rejects.toThrow('已取消发送')
    expect(requestPrivacyReview).toHaveBeenCalledTimes(1)
    expect(calls.generate).not.toHaveBeenCalled()
    expect(calls.native).not.toHaveBeenCalled()
  })

  it('uses the authorized follow list without a selection model round', async () => {
    setup([...bilibiliSetupSites])
    calls.native.mockImplementation(async (name, args) => {
      if (name === 'managed_browser_configure') return { epoch: 4 }
      expect(args.request.kind).toBe('followed_live')
      return { verified: true, data: { loggedIn: true, complete: true, rooms: [{ name: '测试主播', roomId: 18, liveStatus: 1 }] } }
    })
    expect(await sendCompanionTurn('现在B站有谁开播')).toContain('测试主播')
    expect(calls.generate).not.toHaveBeenCalled()
  })

  it('preserves the exact public live-room opener when semantic routing is enabled', async () => {
    const data = setup([...bilibiliSetupSites])
    data.companion.computer.enabled = true
    data.companion.computer.profile = 'trusted_workstation'
    const target = 'https://live.bilibili.com/18'
    calls.native.mockImplementation(async (name, args) => {
      if (name === 'web_search') return [{ url: target, title: '测试主播的直播间', snippet: '' }]
      expect(name).toBe('computer_execute')
      expect(args.request.params.target).toBe(target)
      return { opened: true, target, status: 'submitted_to_default_handler' }
    })
    expect(await sendCompanionTurn('帮我找B站测试主播的直播间')).toContain('交给 Windows')
    expect(calls.generate).not.toHaveBeenCalled()
  })

  it('uses in-scope anonymous HLTV results and filters other origins', async () => {
    setup([hltv])
    const page = hltv + '/team/9565/vitality'
    calls.generate.mockResolvedValueOnce(selectSite(hltv)).mockImplementationOnce(async (request: AgentModelRequest) => {
      expect(request.tools.map(item => item.name)).toEqual(['web.read_page'])
      expect(JSON.stringify(request.messages)).not.toContain('outside.example.com')
      return tool('web.read_page', { url: page })
    }).mockResolvedValueOnce(answer('Vitality 的队伍页面列出了这支战队的阵容。'))
    calls.native.mockImplementation(async (name, args) => {
      if (name === 'web_search') {
        expect(args.query).toMatch(/^site:www\.hltv\.org /u)
        return [{ title: 'Vitality', url: page, snippet: '' }, { title: '外站', url: 'https://outside.example.com/', snippet: '' }]
      }
      expect(name).toBe('public_web_read')
      expect(args.url).toBe(page)
      return { url: page, text: 'Vitality 阵容', title: 'Vitality', untrusted: true, links: [], fetchedAtEpochMs: Date.now() }
    })
    expect(await sendCompanionTurn('Vitality 现在的阵容是谁')).toContain('Vitality')
    expect(calls.native.mock.calls.map(([name]) => name)).toEqual(['web_search', 'public_web_read'])
  })

  it('opens a verified Bilibili video through the real computer permission gate', async () => {
    const data = setup(['https://www.bilibili.com'])
    data.companion.computer.enabled = true
    data.companion.computer.profile = 'trusted_workstation'
    calls.generate
      .mockResolvedValueOnce(response({ site: 1 }))
      .mockResolvedValueOnce(tool('web.read_page', { url: video }))
      .mockResolvedValueOnce(tool('system.open', { target: video }))
    calls.native.mockImplementation(async (name, args) => {
      if (name === 'web_search') return [{ url: video, title: '矩阵入门', snippet: '' }]
      if (name === 'public_web_read') return { url: video, title: '矩阵入门', text: '矩阵乘法教程', links: [], untrusted: true }
      expect(name).toBe('computer_execute')
      expect(args.request).toEqual({ action: 'app_open', params: { target: video } })
      return { opened: true, target: video, status: 'submitted_to_default_handler' }
    })
    expect(await sendCompanionTurn('帮我在B站播放一个讲矩阵的视频')).toContain('交给 Windows 默认浏览器')
    expect(calls.native.mock.calls.map(([name]) => name)).toEqual(['web_search', 'public_web_read', 'computer_execute'])
  })

  it('answers today’s actual seat totals and hands off explicit bookings without a write', async () => {
    const data = setup([seats])
    data.companion.computer.enabled = true
    data.companion.computer.profile = 'trusted_workstation'
    calls.generate.mockImplementation(async () => selectSite(seats))
    calls.native.mockImplementation(async (name, args) => {
      expect(name).toBe('public_web_read')
      expect(args.url).toBe(seats + '/home/web/f_second')
      return { url: args.url, text: '北馆(李文正馆)\n今日剩余361，总量878\n西馆(逸夫馆)\n今日剩余530，总量876', links: [], fetchedAtEpochMs: Date.now() }
    })
    const text = await sendCompanionTurn('北馆还有座位吗')
    expect(text).toContain('北馆 361 个')
    expect(text).not.toContain('西馆')
    calls.native.mockClear()
    calls.native.mockImplementationOnce(async (name, args) => {
      expect(name).toBe('computer_execute')
      expect(args.request).toEqual({ action: 'app_open', params: { target: seats + '/home/web/seat/area/35' } })
      return { opened: true, target: args.request.params.target, status: 'submitted_to_default_handler' }
    })
    const booking = await sendCompanionTurn('帮我预约明天北馆的一个座位')
    expect(booking).toContain('北馆座位预约页交给默认浏览器')
    expect(booking).toContain('提交')
    expect(calls.native).toHaveBeenCalledTimes(1)
  })
})

describe('finite routing and playback authority', () => {
  it.each(['{"site":9}', '{"site":"1"}', '{"site":1,"url":"https://example.com"}', '{"choices":[1,1]}', '{"choices":[2,9]}'])('rejects invalid model results %s', value => {
    expect(parseSiteDecision(value, 3)).toBeUndefined()
  })

  it('requires both explicit playback intent and a verified official video page', () => {
    const action = { id: 'open', name: 'system.open', arguments: { target: video } }
    const read = { id: 'read', name: 'web.read_page', arguments: { url: video } }
    const flow = new PublicSiteFlow('https://www.bilibili.com', '帮我播放讲矩阵的视频')
    expect(flow.authorize(action)).toBeTruthy()
    flow.project(flow.initialCall, { success: true, data: [{ url: video + '?tracking=123', title: '矩阵入门' }] })
    expect(flow.authorize(read)).toBeUndefined()
    expect(flow.authorize(action)).toBeTruthy()
    flow.project(read, { success: true, data: { url: video, title: '矩阵入门', links: [] } })
    expect(flow.authorize(action)).toBeUndefined()
    expect(flow.openReply(action, { success: true, data: { opened: true, target: video, status: 'submitted_to_default_handler' } })).toContain('交给 Windows')
    expect(flow.authorize(action)).toBeTruthy()
    expect(new PublicSiteFlow('https://www.bilibili.com', '找视频，别播放').allowsTool('system.open')).toBe(false)
  })

  it('normalizes local site annotations without granting access', () => {
    expect(normalizeBrowser({ semanticRouting: true, sites: [courses], profiles: [
      { origin: courses, role: 'portal', purpose: '  教学网站  ', abilities: ['查询资料', '查询资料'] },
      { origin: rain, role: 'portal', purpose: '课程', abilities: ['查询资料'] },
    ] })).toMatchObject({ semanticRouting: true, sites: [courses], profiles: [{ origin: courses, purpose: '教学网站', abilities: ['查询资料'] }] })
  })
})
