import type { AgentToolResult } from '../companion/agent/types'
import { escapePageText as plain } from './pageEvidence'
import type { CreatorActivityTarget } from '../../domain/creatorActivityIntent'

export function creatorActivityReply(result: AgentToolResult, target: CreatorActivityTarget, showSources = false) {
  if (!result.success) return result.error?.message || '专用浏览器未能完成创作者动态查询。'
  const snapshot = result.data as { verified?: boolean; data?: Record<string, unknown> } | undefined
  const activity = snapshot?.verified === true ? snapshot.data : undefined
  const name = target.name ?? '这个账号'
  switch (activity?.status) {
    case 'found': {
      if (typeof activity.name !== 'string' || target.name && activity.name !== target.name
        || typeof activity.text !== 'string' || typeof activity.published !== 'string'
        || typeof activity.profileUrl !== 'string' || !/^https:\/\/space\.bilibili\.com\/[1-9]\d{0,18}\/dynamic$/u.test(activity.profileUrl)
        || target.uid && activity.profileUrl !== `https://space.bilibili.com/${target.uid}/dynamic`) break
      const when = plain(activity.published)
      const content = activity.text.trim() ? plain(activity.text.trim()) : '这条动态以图片或视频为主。'
      return `「${plain(activity.name)}」最新一条可见动态发布于${when}。\n\n${content}${showSources ? `\n\n[查看个人空间动态](${activity.profileUrl})` : ''}`
    }
    case 'ambiguous': return `B 站用户搜索返回了多个叫「${plain(name)}」的账号。请给我个人空间链接，我可以按链接查最新动态。`
    case 'not_found': return `我在 B 站用户搜索里没找到能核对为「${plain(name)}」的账号。可以补充当前昵称或个人空间链接。`
    case 'empty': return `「${plain(name)}」的个人空间当前显示暂无可见动态。`
    case 'login_required': return 'B 站个人空间要求登录。请在「小鱼专用浏览器」里打开该网站的登录窗口，登录完成后结束登录，小鱼会续查当前请求。'
    case 'identity_unverified': return '我打开了 B 站个人空间，但页面还没有提供能核对的昵称，暂时不能确认是哪位创作者。'
    case 'time_unverified': return '我读到了动态列表，但发布时间不足以判断哪条最新。'
    case 'unavailable': return target.uid ? 'B 站个人空间尚未返回可核对的动态，本次结果未知。' : 'B 站未返回可以核对的账号或动态。若你有个人空间链接，可以直接按链接继续查。'
  }
  return '创作者动态的浏览器回执未通过校验，本次结果未知。'
}
