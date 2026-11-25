export const bilibiliReference = /(?:b\s*站|哔哩哔哩|哔哩|bilibili)/iu

type LiveStatusIntent =
  | { kind: 'named'; name: string }
  | { kind: 'missing' | 'followed' | 'public-list' }

const timeCue = '(?:现在|今天|此刻|这会儿|已经)'
const question = '(?:(?:正在|在)?(?:开播|直播)(?:了)?(?:没有|没|吗)|(?:有没有|是否)(?:正在|在)?(?:开播|直播|在播)|在播吗|播着吗)'
const relativeSubject = '(?:[他她]|(?:这|那)(?:位|个|名)?(?:主播|up\\s*主|直播间))'
const namedQuestion = new RegExp(`^(.+?)\\s*(?:${timeCue}\\s*)?${question}$`, 'iu')
const missingSubject = new RegExp(`^(?:${relativeSubject}\\s*)?(?:${timeCue}\\s*)?${question}$`, 'iu')

const broadcasting = /(?:开播|直播|在播|live)/iu
const following = /(?:关注|follow|账号|账户|直播列表|直播名单)/iu
const streamers = /(?:up\s*主|主播|关注的人)/iu
const groupQuestion = /(?:有谁|谁在|谁正|哪[些几位]|谁.*(?:开播|直播|在播)|(?:开播|在播).*谁)/u
const activityUpdate = /(?:更新|新视频|投稿|动态|新作品|新发|发了视频)/u
const quantifiedGroup = /(?:(?:有没有|还有|有|哪些|多少|几位)\s*(?:up\s*主|主播)(?:们)?|(?:up\s*主|主播)(?:们|里面|里|中)?[\s，,]*(?:有没有|还有|有|谁|哪些|多少|几位))\s*(?:现在|正在|已经|在)?\s*(?:开播|在播|直播)/iu
// The platform can be the only named subject in a group question.
const implicitGroup = new RegExp(`(?:(?:谁|哪些人?|(?:哪)?几(?:位|个|名)人?|多少人)\\s*(?:${timeCue}\\s*)?(?:正在|已经|在)?\\s*(?:开播|在播|直播)|(?:开播|在播|直播)(?:的)?\\s*(?:都有|还有|有|是)?\\s*谁)`, 'u')
const publicScope = /(?:全站|热门|推荐|不[是看查]*关注|随便|所有主播)/u

export const isBilibiliActivityRequest = (message: string) => bilibiliReference.test(message)
  && activityUpdate.test(message) && /(?:关注|up\s*主|主播|我的|投稿|新视频)/iu.test(message)

export function interpretLiveStatus(message: string): LiveStatusIntent | undefined {
  const normalized = message.normalize('NFKC').trim().replace(/[?？。！!]+$/u, '')
  const command = normalized.replace(/^(?:(?:请|麻烦|帮我|替我|给我)[,，\s]*)*/u, '')
  if (/^(?:如果|假如|为什么|怎么|如何|介绍|解释|讨论|不要|别|无需|不用|是否能|能否)|(?:斗鱼|虎牙|抖音|快手)/u.test(command)) return

  if (bilibiliReference.test(command) && broadcasting.test(command)) {
    if (isBilibiliActivityRequest(command)) return
    const group = quantifiedGroup.test(command) || implicitGroup.test(command)
      || streamers.test(command) && groupQuestion.test(command)
    if (publicScope.test(command) && (group || /(?:推荐.*(?:主播|直播间)|直播(?:列表|名单|榜))/u.test(command))) return { kind: 'public-list' }
    if ((group || following.test(command)) && !/(?:顺便|然后|并且|之后再|https?:\/\/)/iu.test(command)) {
      return publicScope.test(command) ? { kind: 'public-list' } : { kind: 'followed' }
    }
  }

  const text = normalized
    .replace(/^(?:那(?:么)?|所以)[,，\s]*(?=请|帮|查|看|他|她|现在|此刻|这会儿|开播|是否)/u, '')
    .replace(/^(?:(?:请|你|帮我|替我|麻烦)[,，\s]*)*(?:(?:查询|查看|查查|查|看看|看|核对)(?:一下)?[,，\s]*)?/u, '')
    .replace(/^(?:(?:现在|今天|此刻|这会儿)\s*)?(?:(?:b\s*站|哔哩哔哩|哔哩|bilibili)\s*(?:上|里|的)?\s*)?(?:up\s*主|主播)?\s*/iu, '')
  if (!text) return
  if (missingSubject.test(text)) return { kind: 'missing' }
  const match = namedQuestion.exec(text)
  const name = match?.[1]?.trim().replace(/^[「『“"《]+|[」』”"》]+$/gu, '').trim()
  if (!name || [...name].length > 60 || /[,，。!！?？;；\r\n\p{Cc}]|https?:|@|(?:并且|然后|顺便|打开|录屏|送礼|登录|关注|查一下|查查|开播)/iu.test(name)) return
  if (/^(?:有|还有|有没有|哪些|多少|几位|所有|全站|某个|哪个)\s*(?:up\s*主|主播)/iu.test(name)) return
  if (/^(?:(?:还有|有)?谁|我|你|他|她|up\s*主|主播|直播|在)$/iu.test(name)) return
  return { kind: 'named', name }
}

export const needsLiveStatusTarget = (message: string) => interpretLiveStatus(message)?.kind === 'missing'

export function parseLiveStatusIntent(message: string) {
  const intent = interpretLiveStatus(message)
  return intent?.kind === 'named' ? intent.name : undefined
}
