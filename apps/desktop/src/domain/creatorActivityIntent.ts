import { bilibiliReference } from './liveStatusIntent'

const platform = /^(?:b\s*站|哔哩哔哩|bilibili)(?:上|里|的)?\s*/iu
const action = /^(?:(?:请|麻烦|帮我|替我|给我|我想|去)\s*)*(?:(?:查一下|查一查|查看|查询|查查|查|看一下|看看|看)(?:一下)?\s*)?/u
const target = /^(.{2,60}?)(?:的)?\s*(?:最[新近](?:发的|发布的)?(?:一条|那条)?(?:动态|更新)|(?:刚刚|最近)(?:发了|发的|更新了)什么(?:动态)?|(?:最新|最后)(?:发了|发的)什么(?:动态)?)(?:是(?:啥|什么|哪一条)|说了什么|发了什么|内容是什么|吗|呢|呀)?$/u
const excluded = /^(?:别|不[要用]|无需|如果|假如|如何|怎么|为什么|讨论|解释)/u
const multiple = /(?:微博|抖音|虎牙|斗鱼|小红书|快手|YouTube|Twitch|Instagram|顺便|然后|并且|并发|转发)/iu

export interface CreatorActivityTarget { name?: string; uid?: string }

export function creatorActivityName(message: string, hasBilibili: boolean) {
  const clean = message.normalize('NFKC').trim().replace(/[。！？!?]+$/u, '').replace(action, '').replace(platform, '')
  const namedPlatform = bilibiliReference.test(message) || /^(?:up\s*主|主播)/iu.test(clean)
  if (!namedPlatform && (!hasBilibili || !clean.includes('动态'))) return
  if (excluded.test(clean) || multiple.test(clean) || /[,，。;；?？\n@]|https?:/iu.test(clean)) return
  const name = target.exec(clean)?.[1]?.replace(/^(?:up\s*主|主播)\s*/iu, '').replace(/^[「『“"]+|[」』”"]+$/gu, '').trim()
  if (!name || /(?:我关注|我的|关注的|所有|哪个|谁|哪[些个位]|\p{Cc}|密码|令牌|验证码)/u.test(name)) return
  return name
}

export function creatorActivityTarget(message: string, hasBilibili: boolean): CreatorActivityTarget | undefined {
  const clean = message.normalize('NFKC').trim().replace(action, '')
  if (excluded.test(clean) || multiple.test(clean)) return
  const links = clean.match(/https?:\/\/[^\s，。；;"'\\<>）)！？]+/giu) ?? []
  if (links.length === 1 && /(?:最新|最近|新发|刚发).{0,12}动态/u.test(clean)) {
    const uid = /^https:\/\/space\.bilibili\.com\/([1-9]\d{0,18})(?:\/dynamic)?\/?$/iu.exec(links[0])?.[1]
    if (uid) return { uid }
  }
  const name = creatorActivityName(message, hasBilibili)
  return name ? { name } : undefined
}
