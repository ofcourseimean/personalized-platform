const timeCue = '(?:现在|今天|此刻|这会儿|已经)'
const question = '(?:(?:正在|在)?(?:开播|直播)(?:了)?(?:没有|没|吗)|(?:有没有|是否)(?:正在|在)?(?:开播|直播|在播)|在播吗|播着吗)'
const relativeSubject = '(?:[他她]|(?:这|那)(?:位|个|名)?(?:主播|up\\s*主|直播间))'
const namedQuestion = new RegExp(`^(.+?)\\s*(?:${timeCue}\\s*)?${question}$`, 'iu')
const missingSubject = new RegExp(`^(?:${relativeSubject}\\s*)?(?:${timeCue}\\s*)?${question}$`, 'iu')

function liveStatusText(message: string) {
  const text = message.normalize('NFKC').trim().replace(/[?？。！!]+$/u, '')
  if (/^(?:如果|假如|为什么|怎么|如何|不要|别|不用|是否能|能否)|(?:斗鱼|虎牙|抖音|快手)/u.test(text)) return undefined
  return text
    .replace(/^(?:那(?:么)?|所以)[,，\s]*(?=请|帮|查|看|他|她|现在|此刻|这会儿|开播|是否)/u, '')
    .replace(/^(?:(?:请|你|帮我|替我|麻烦)[,，\s]*)*(?:(?:查询|查看|查查|查|看看|看|核对)(?:一下)?[,，\s]*)?/u, '')
    .replace(/^(?:(?:现在|今天|此刻)\s*)?(?:(?:b\s*站|哔哩哔哩|bilibili)\s*(?:上|里|的)?\s*)?(?:up\s*主|主播)?\s*/iu, '')
}

export function needsLiveStatusTarget(message: string) {
  const text = liveStatusText(message)
  return text !== undefined && missingSubject.test(text)
}

export function parseLiveStatusIntent(message: string) {
  const text = liveStatusText(message)
  if (!text || missingSubject.test(text)) return undefined
  const match = namedQuestion.exec(text)
  const name = match?.[1]?.trim().replace(/^[「『“"《]+|[」』”"》]+$/gu, '').trim()
  if (!name || [...name].length > 60 || /[,，。!！?？;；\r\n\p{Cc}]|https?:|@|(?:并且|然后|顺便|打开|录屏|送礼|登录|关注|查一下|查查|开播)/iu.test(name)) return undefined
  if (/^(?:有|还有|有没有|哪些|多少|几位|所有|全站|某个|哪个)\s*(?:up\s*主|主播)/iu.test(name)) return undefined
  if (/^(?:谁|我|你|他|她|up\s*主|主播|直播|在)$/iu.test(name)) return undefined
  return name
}
