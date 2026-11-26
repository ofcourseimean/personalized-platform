import { stripCompanionAddress } from '../../domain/companionIdentity'
import { interpretLiveStatus, isBilibiliActivityRequest } from '../../domain/liveStatusIntent'
import { parseLiveRoomIntent } from '../companion/agent/liveRoomIntent'

export type BrowserObjective = 'followed_live' | 'updates' | 'mail' | 'page'
const action = /(?:查看|检查|看看|看一下|查查|查一下|查一查|查下|查询|汇总|翻页|筛选|check|读取|读一下|找|获取|有没有|有新|谁|哪|网页|浏览器|(?:帮我|替我|给我).*(?:看|查|核对)|(?:看|查).*(?:订单|通知|公告|消息|邮件|邮箱)|\b(?:any|new|show|read|updates)\b)/iu
const discussion = /^(?:(?:请|麻烦|帮我|替我|给我)[,，\s]*)*(?:为什么|如何|怎么实现|介绍|解释|讨论|假如|如果|不要|别|无需|不用)/u
export function isBrowserConnectionCheck(message: string) {
  const text = message.trim().replace(/[。！!？?]+$/u, '')
  return /^(?:(?:请|帮我|检查|查询|查一下|看看|查看)\s*)*(?:小鱼\s*)?(?:专用浏览器|内置浏览器|浏览器|edge\s*(?:浏览器|扩展)?)(?:的|是否|有没有|现在|还)?\s*(?:连接状态|连接|已连接|连上了?(?:吗|没)?|已配对|在线(?:吗)?|状态)$/iu.test(text)
}

export function browserObjective(message: string, companionName?: string): BrowserObjective | undefined {
  message = stripCompanionAddress(message, companionName).normalize('NFKC')
  if (discussion.test(message) || isBrowserConnectionCheck(message)) return
  if (isBilibiliActivityRequest(message)) return 'updates'
  const live = interpretLiveStatus(message)
  if (live?.kind === 'followed') return 'followed_live'
  if (live || parseLiveRoomIntent(message)) return
  if (/(?:邮箱|邮件|收件箱|email|mail|inbox)/iu.test(message) && action.test(message) && !/(?:发送|发一封|写一封|删除|清空)/u.test(message)) return 'mail'
  if (action.test(message) || /下载|download/iu.test(message)) return 'page'
}
export function followedLiveIntent(message: string) { return browserObjective(message) === 'followed_live' }
