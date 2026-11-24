import { stripCompanionAddress } from '../../domain/companionIdentity'
import { needsLiveStatusTarget, parseLiveStatusIntent } from '../../domain/liveStatusIntent'

type LiveTarget = { name?: string; timer: ReturnType<typeof setTimeout> }
const targets = new Map<string, LiveTarget>()

export function clearLiveStatusTarget(channel: string) {
  const previous = targets.get(channel)
  if (previous) clearTimeout(previous.timer)
  targets.delete(channel)
}

export function continueLiveStatusTurn(message: string, companionName: string, channel: string) {
  const previous = targets.get(channel)
  clearLiveStatusTarget(channel)
  if (!previous) return message
  const text = stripCompanionAddress(message, companionName)
  if (previous.name) {
    if (!needsLiveStatusTarget(text) && !/^(?:(?:那|那么)\s*)?(?:现在呢|这会儿呢|再查一次|再查一下|重新查一下)[。？?！!]?$/u.test(text)) return message
    return `查询「${previous.name}」现在是否开播`
  }
  const name = text.replace(/^(?:就是|我说的是|主播是)[，,：:\s]*/u, '').replace(/^[「『“"]+|[」』”"。！!]+$/gu, '').trim()
  if (!/^[\p{L}\p{N}_· -]{2,40}$/u.test(name) || /^(?:取消|算了|先不|不了|好的|你好|谢谢|看看|查询|重新|想问|为什么|怎么|告诉我|去|打开)/u.test(name)) return message
  return `查询「${name}」现在是否开播`
}

export function rememberLiveStatusTarget(message: string, companionName: string, channel: string) {
  const text = stripCompanionAddress(message, companionName)
  const name = parseLiveStatusIntent(text)
  if (!name && !needsLiveStatusTarget(text)) return
  clearLiveStatusTarget(channel)
  targets.set(channel, { name, timer: setTimeout(() => clearLiveStatusTarget(channel), 300_000) })
}
