import { describe, expect, it } from 'vitest'
import { activityTime, creatorProfiles, newestActivity } from '../../../../browser-runtime/creator-activity.mjs'
import type { ActivityPost } from '../../../../browser-runtime/creator-activity.mjs'
import { creatorActivityName } from '../../../domain/creatorActivityIntent'

describe('named creator activity discovery', () => {
  it.each([
    '天才美少女卡莎最新一条动态是啥',
    '看看B站主播天才美少女卡莎最近发布的动态',
    '哔哩哔哩天才美少女卡莎刚刚发了什么动态',
  ])('identifies the creator in %s', message => {
    expect(creatorActivityName(message, true)).toBe('天才美少女卡莎')
  })

  it.each(['看看我关注的主播最近发布的动态','查微博天才美少女卡莎最新动态','不要查天才美少女卡莎最新动态','天才美少女卡莎最新动态，并且发出去','陈老师最近更新了什么'])('does not consume other intents %s', message => {
    expect(creatorActivityName(message, true)).toBeUndefined()
  })

  it('keeps exact official identities and treats two different accounts as ambiguous', () => {
    expect(creatorProfiles([
      { labels: ['虚构主播的切片'], href: 'https://space.bilibili.com/1' },
      { labels: ['虚构主播'], href: 'https://space.bilibili.com.evil.com/2' },
      { labels: ['虚构主播'], href: 'https://space.bilibili.com/20?trace=1' },
      { labels: ['虚构主播'], href: 'https://space.bilibili.com/20/dynamic' },
      { labels: ['虚构主播'], href: 'https://space.bilibili.com/40' },
    ], '虚构主播')).toEqual(['https://space.bilibili.com/20', 'https://space.bilibili.com/40'])
  })
})

describe('creator publication time evidence', () => {
  const now = Date.parse('2026-11-25T15:00:00+08:00')
  const post = (published: string, pinned: boolean, text = '动态正文'): ActivityPost => ({ published, pinned, text, timestamp: '', media: false })

  it('checks clock, calendar and year boundaries in China time', () => {
    expect(activityTime('昨天 14:30', now)).toBe(Date.parse('2026-11-24T14:30:00+08:00'))
    expect(activityTime('2026年11月25日 13:00', now)).toBe(Date.parse('2026-11-25T13:00:00+08:00'))
    expect(activityTime('12-25', now)).toBe(Date.parse('2025-12-25T00:00:00+08:00'))
    expect(activityTime('8月7日 · 投稿了视频', now)).toBe(Date.parse('2026-08-07T00:00:00+08:00'))
    expect(activityTime('2026-02-30', now)).toBeNaN()
    expect(activityTime('没有时间', now)).toBeNaN()
  })

  it('sorts observed publication times instead of selecting the pinned card', () => {
    const pinned = post('2026-10-01', true, '旧置顶')
    const actual = post('2小时前', false, '新动态')
    const yesterday = post('昨天 17:00', false)
    expect(newestActivity([pinned, yesterday, actual, post('8月7日 · 投稿了视频', false)], now)?.post).toEqual(actual)
    expect(newestActivity([pinned], now)).toBeUndefined()
    expect(newestActivity([actual, post('刚才', false)], now)).toBeUndefined()
  })
})
