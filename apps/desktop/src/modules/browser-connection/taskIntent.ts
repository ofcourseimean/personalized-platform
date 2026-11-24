import { stripCompanionAddress } from '../../domain/companionIdentity'
import { needsLiveStatusTarget, parseLiveStatusIntent } from '../../domain/liveStatusIntent'

export type BrowserObjective = 'followed_live' | 'updates' | 'mail' | 'page'
const action = /(?:查看|检查|看看|看一下|查查|查询|汇总|翻页|筛选|check|读取|读一下|找|获取|有没有|有新|谁|哪|网页|浏览器|(?:帮我|替我|给我).*(?:看|查|核对)|(?:看|查).*(?:订单|通知|公告|消息|邮件|邮箱)|\b(?:any|new|show|read|updates)\b)/iu
const discussion = /^(?:为什么|如何|怎么实现|介绍|解释|讨论|假如|如果|不要|别|无需|不用)/u
const bili = /(?:b\s*站|哔哩|bilibili)/iu
const live = /(?:开播|直播|在播|live)/iu
const updates = /(?:更新|新视频|投稿|动态|新作品|新发|发了视频)/u
const account = /(?:关注|follow|账号|账户|列表|名单)/iu
const upGroup = /(?:up\s*主|主播|关注的人)/iu
const whoLive = /(?:有谁|谁在|谁正|哪[些几位]|谁.*(?:开播|直播|在播)|(?:开播|在播).*谁)/u
// Quantified groups are not named streamers. “有UP主开播吗” means a group,
// while “UP主卡莎开播了吗” and “某个主播开播没” remain single-target queries.
const quantifiedGroup = /(?:(?:有没有|还有|有|哪些|多少|几位)\s*(?:up\s*主|主播)|(?:up\s*主|主播)(?:们|里面|里|中)?[\s，,]*(?:有没有|还有|有|谁|哪些|多少|几位))/iu
const publicLive = /(?:全站|热门|推荐|不[是看查]*关注|不看关注|随便|所有主播)/u
export function isBrowserConnectionCheck(message: string) {
  const text = message.trim().replace(/[。！!？?]+$/u, '')
  return /^(?:(?:请|帮我|检查|查询|查一下|看看|查看)\s*)*(?:小鱼\s*)?(?:专用浏览器|内置浏览器|浏览器|edge\s*(?:浏览器|扩展)?)(?:的|是否|有没有|现在|还)?\s*(?:连接状态|连接|已连接|连上了?(?:吗|没)?|已配对|在线(?:吗)?|状态)$/iu.test(text)
}

export function browserObjective(message: string, companionName?: string): BrowserObjective | undefined {
  message = stripCompanionAddress(message, companionName)
  if (discussion.test(message) || isBrowserConnectionCheck(message)) return
  if (bili.test(message) && updates.test(message) && /(?:关注|up\s*主|主播|我的|投稿|新视频)/iu.test(message)) return 'updates'
  if (bili.test(message) && live.test(message) && !publicLive.test(message)
    && (account.test(message) || quantifiedGroup.test(message) || upGroup.test(message) && whoLive.test(message))) return 'followed_live'
  if (parseLiveStatusIntent(message) || needsLiveStatusTarget(message)) return
  if (/(?:邮箱|邮件|收件箱|email|mail|inbox)/iu.test(message) && action.test(message) && !/(?:发送|发一封|写一封|删除|清空)/u.test(message)) return 'mail'
  if (action.test(message) || /下载|download/iu.test(message)) return 'page'
}
export function followedLiveIntent(message: string) { return browserObjective(message) === 'followed_live' }
