import { describe, expect, it, vi } from 'vitest'
import type { AgentModelProvider, AgentModelRequest } from '../companion/agent/types'
import { detectPrivacy } from './detectors'
import { createPrivacyProtectedProvider, protectOutboundText } from './egressGateway'
import { PrivacyEgressError } from './types'

const trust = { externalAiProcessing: true, shareAuthorizedContext: true, shareRecentConversation: true, retainConversationHistory: true, outboundProtection: true, outboundReviewMode: 'balanced' as const, privateDictionary: [{ id: 'one', value: '林夏', category: 'person' as const, enabled: true }] }
const request = (content: string) => ({ messages: [{ role: 'user' as const, content }], context: { page: 'home', companion: { name: '小鱼' }, localTime: { timeZone: 'Asia/Shanghai' as const, date: '2026-09-22', time: '10:00:00', weekday: '星期二', period: '上午' } }, tools: [] })

describe('privacy egress', () => {
  it('detects Chinese phone, valid identity card and private dictionary terms', () => {
    const findings = detectPrivacy('林夏的电话是13800138000，身份证11010519491231002X。', trust.privateDictionary)
    expect(findings.map((item) => item.kind)).toEqual(['person', 'phone', 'identity'])
  })

  it('detects card numbers in prose but ignores Luhn-valid URL identifiers', () => {
    expect(detectPrivacy('card 4111111111111111')).toMatchObject([{ kind: 'bank_card' }])
    expect(detectPrivacy('source https://example.com/article/4111111111111111')).toEqual([])
  })

  it('blocks secrets before a provider is called', async () => {
    let called = false
    const base: AgentModelProvider = { id: 'deepseek', testConnection: async () => '', generate: async () => { called = true; return { type: 'text', text: '' } } }
    const provider = createPrivacyProtectedProvider(base, { trust, destination: 'DeepSeek', purpose: 'test' })
    await expect(provider.generate(request('api_key=sk-abcdefghijklmnopqrstuvwxyz'))).rejects.toBeInstanceOf(PrivacyEgressError)
    expect(called).toBe(false)
  })

  it('protects a restored tool query again before web search without a redundant review', async () => {
    const review = vi.fn(async () => true)
    const protectedQuery = await protectOutboundText('搜索林夏的近况', {
      trust,
      destination: 'Bing Search',
      purpose: '联网查询',
      requestReview: review,
    })
    expect(protectedQuery).toBe('搜索[PERSON_1]的近况')
    expect(review).not.toHaveBeenCalled()
  })

  it('uses stable aliases and restores replies without interrupting routine redaction', async () => {
    const sent: string[] = []; let reviews = 0
    const base: AgentModelProvider = { id: 'deepseek', testConnection: async () => '', generate: async (value) => { sent.push(value.messages.at(-1)?.content ?? ''); return { type: 'text', text: '找到[PERSON_1]，电话[PHONE_1]' } } }
    const provider = createPrivacyProtectedProvider(base, { trust, destination: 'DeepSeek', purpose: 'test', requestReview: async () => { reviews += 1; return true } })
    const response = await provider.generate(request('查找林夏，电话13800138000'))
    expect(sent[0]).toBe('查找[PERSON_1]，电话[PHONE_1]')
    expect(response).toEqual({ type: 'text', text: '找到林夏，电话13800138000' })
    expect(reviews).toBe(0)
  })

  it('requires confirmation for identity and payment data, without repeating an approved finding in the same round', async () => {
    const generate = vi.fn(async (_request: AgentModelRequest) => ({ type: 'text' as const, text: '好' }))
    const review = vi.fn(async () => true)
    const provider = createPrivacyProtectedProvider({ id: 'deepseek', generate, testConnection: async () => '' }, {
      trust, destination: 'DeepSeek', purpose: 'test', requestReview: review,
    })
    const identity = '证件示例 11010519491231002X'

    await provider.generate(request(identity))
    await provider.generate(request(identity))
    expect(review).toHaveBeenCalledTimes(1)
    expect(review).toHaveBeenCalledWith(expect.objectContaining({
      findingCounts: { identity: 1 }, sanitizedPreview: '证件示例 [IDENTITY_1]',
    }))
    expect(generate.mock.calls[0][0].messages[0].content).toBe('证件示例 [IDENTITY_1]')

    review.mockResolvedValueOnce(false)
    await expect(provider.generate(request('银行卡示例 4111111111111111'))).rejects.toThrow('取消发送')
    expect(review).toHaveBeenCalledTimes(2)
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('keeps the explicitly selected strict review policy for clean text', async () => {
    const review = vi.fn(async () => false)
    await expect(protectOutboundText('今天是什么日期', {
      trust: { ...trust, outboundReviewMode: 'strict' }, destination: 'Search', purpose: 'test', requestReview: review,
    })).rejects.toThrow('取消发送')
    expect(review).toHaveBeenCalledTimes(1)
  })

  it('redacts routine identifiers from past conversation without prompting and still blocks credentials', async () => {
    const generate = vi.fn(async (_request: AgentModelRequest) => ({ type: 'text' as const, text: '好' }))
    const review = vi.fn(async () => true)
    const provider = createPrivacyProtectedProvider({ id: 'deepseek', generate, testConnection: async () => '' }, {
      trust, destination: 'DeepSeek', purpose: 'test', requestReview: review,
    })
    const newTurn = request('谢谢')
    await provider.generate({ ...newTurn, messages: [
      { role: 'user', content: '之前的邮箱示例 first@example.com' }, ...newTurn.messages,
    ] })
    expect(review).not.toHaveBeenCalled()
    expect(generate.mock.calls[0][0].messages[0].content).toBe('之前的邮箱示例 [EMAIL_1]')

    await expect(provider.generate({ ...newTurn, messages: [
      { role: 'assistant', content: 'password=fixture-secret-password' }, ...newTurn.messages,
    ] })).rejects.toBeInstanceOf(PrivacyEgressError)
    expect(generate).toHaveBeenCalledTimes(1)
  })

  it('identifies new sensitive content in a tool result across model calls', async () => {
    const generate = vi.fn(async (_request: AgentModelRequest) => ({ type: 'text' as const, text: '好' }))
    const review = vi.fn(async () => true)
    const provider = createPrivacyProtectedProvider({ id: 'deepseek', generate, testConnection: async () => '' }, {
      trust, destination: 'DeepSeek', purpose: 'test', requestReview: review,
    })
    const turn = request('继续这次查询')
    await provider.generate(turn)
    await provider.generate({ ...turn, messages: [
      ...turn.messages,
      { role: 'tool', content: JSON.stringify({ data: { text: '结果\n证件示例 11010519491231002X' } }) },
      { role: 'system', content: '继续总结结果' },
    ] })
    expect(review).toHaveBeenCalledOnce()
    expect(review).toHaveBeenCalledWith(expect.objectContaining({
      findingCounts: { identity: 1 }, sanitizedPreview: '结果\n证件示例 [IDENTITY_1]',
    }))
  })

  it('restores split streaming aliases and tool call arguments locally', async () => {
    let step = 0; const chunks: string[] = []
    const base: AgentModelProvider = {
      id: 'deepseek', testConnection: async () => '',
      generate: async (_value, options) => {
        step += 1
        if (step === 1) return { type: 'tool_call', call: { id: 'call-1', name: 'character.search', arguments: { query: '[PERSON_1]' } } }
        options?.onTextDelta?.('认识[PER'); options?.onTextDelta?.('SON_1]。')
        return { type: 'text', text: '认识[PERSON_1]。' }
      },
    }
    const provider = createPrivacyProtectedProvider(base, { trust, destination: 'DeepSeek', purpose: 'test', requestReview: async () => true })
    const call = await provider.generate(request('查找林夏'))
    expect(call).toMatchObject({ type: 'tool_call', call: { arguments: { query: '林夏' } } })
    const response = await provider.generate(request('林夏'))
    expect(response).toEqual({ type: 'text', text: '认识林夏。' })
    await provider.generate(request('林夏'), { onTextDelta: (delta) => chunks.push(delta) })
    expect(chunks.join('')).toBe('认识林夏。')
  })
})
