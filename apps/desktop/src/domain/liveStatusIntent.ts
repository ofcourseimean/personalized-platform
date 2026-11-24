export function parseLiveStatusIntent(message: string) {
  let text = message.normalize('NFKC').trim().replace(/[?？。！!]+$/u, '')
  if (/^(?:如果|假如|为什么|怎么|如何|不要|别|不用|是否能|能否)|(?:斗鱼|虎牙|抖音|快手)/u.test(text)) return undefined
  text = text
    .replace(/^(?:(?:请|你|帮我|替我|麻烦)[,，\s]*)*(?:(?:查询|查看|查查|查|看看|看|核对)(?:一下)?[,，\s]*)?/u, '')
    .replace(/^(?:(?:现在|今天|此刻)\s*)?(?:(?:b\s*站|哔哩哔哩|bilibili)\s*(?:上|里|的)?\s*)?(?:up\s*主|主播)?\s*/iu, '')
  const match = /^(.+?)\s*(?:(?:现在|今天|此刻)\s*)?(?:(?:正在|在)?(?:开播|直播)(?:了)?(?:没有|没|吗)|有没有开播|是否开播|在播吗)$/u.exec(text)
  const name = match?.[1]?.trim().replace(/^[「『“"《]+|[」』”"》]+$/gu, '').trim()
  if (!name || [...name].length > 60 || /[,，。!！?？;；\r\n\p{Cc}]|https?:|@|(?:并且|然后|顺便|打开|录屏|送礼|登录|关注|查一下|查查|开播)/iu.test(name)) return undefined
  if (/^(?:有|还有|有没有|哪些|多少|几位|所有|全站|某个|哪个)\s*(?:up\s*主|主播)/iu.test(name)) return undefined
  if (/^(?:谁|我|你|他|她|up\s*主|主播|直播|在)$/iu.test(name)) return undefined
  return name
}
