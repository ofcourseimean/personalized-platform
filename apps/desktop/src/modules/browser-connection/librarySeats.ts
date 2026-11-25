import type { PublicReadResult } from '../../infrastructure/publicWeb'
import type { AgentToolCall, AgentToolResult } from '../companion/agent/types'

export const librarySeatOrigin = 'https://seat.lib.tsinghua.edu.cn'
const seatOverview = `${librarySeatOrigin}/home/web/f_second`
const venues = [
  { name: '北馆', aliases: ['北馆', '李文正馆'], id: 35 },
  { name: '西馆', aliases: ['西馆', '逸夫馆'], id: 64 },
  { name: '文科图书馆', aliases: ['文科图书馆', '文科馆', '人文社科图书馆'], id: 89 },
  { name: '法律图书馆', aliases: ['法律图书馆', '法律馆'], id: 6 },
  { name: '美术图书馆', aliases: ['美术图书馆', '美术馆'], id: 19 },
  { name: '金融图书馆', aliases: ['金融图书馆', '金融馆'], id: 29 },
]

function venueFor(message: string) {
  const matches = venues.filter(venue => venue.aliases.some(alias => message.includes(alias)))
  return matches.length === 1 ? matches[0] : undefined
}

export function prepareLibrarySeatQuery(message: string) {
  const venue = venueFor(message)
  const link = venue ? `${librarySeatOrigin}/home/web/seat/area/${venue.id}` : seatOverview
  if (/(?:帮我|替我|给我|^请?)(?:.{0,20})?(?:预约|订个|订一个|约个)(?:.{0,35})(?:座|馆)|(?:座|馆).{0,15}(?:帮我预约|替我预约)/u.test(message)
    && !/(?:别|不要|不用|怎么|如何|能不能|可以|是否|了吗|预约规则)/u.test(message)) {
    const label = `${venue?.name ?? '图书馆'}座位预约页`
    const call: AgentToolCall = { id: `seat-booking-${crypto.randomUUID()}`, name: 'system.open', arguments: { target: link } }
    return { call, summarize(result: AgentToolResult) {
      const receipt = result.data as { opened?: boolean; target?: string; status?: string } | undefined
      const submitted = result.success && receipt?.opened && receipt.target === link && receipt.status === 'submitted_to_default_handler'
      return `${submitted ? `已把${label}交给默认浏览器打开` : `[打开${label}](${link})`}。请在页面选定日期、时段和座位后提交。`
    } }
  }
  if (/(?:明天|后天|昨[天晚]|明晚|今晚|上[午周]|下[午周]|周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}[:：]\d{2}|\d{1,2}点|\d{1,2}月\d{1,2}[日号])/u.test(message)) {
    return { reply: `[查看${venue?.name ?? '图书馆'}的分时段座位](${link})。公开余量只按今天汇总，请在页面选择你要查的日期和时段。` }
  }
  const call: AgentToolCall = { id: `seats-${crypto.randomUUID()}`, name: 'web.read_page', arguments: { url: seatOverview } }
  return { call, summarize(result: AgentToolResult) {
    const page = result.success ? result.data as PublicReadResult | undefined : undefined
    const text = page?.url === seatOverview && typeof page.text === 'string' ? page.text.replace(/\s+/gu, ' ').normalize('NFKC') : ''
    const rows = (venue ? [venue] : venues).flatMap(item => {
      const name = item.name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
      const match = new RegExp(`${name}(?:\\([^)]{1,24}\\))?\\s*今日剩余\\s*(\\d{1,4})\\s*[,，]\\s*总量\\s*(\\d{1,4})`, 'u').exec(text)
      return match && Number(match[1]) <= Number(match[2]) ? [`${item.name} ${match[1]} 个`] : []
    })
    if (!rows.length) return `暂时无法从座位系统确认余量。[查看座位页](${link})`
    const fetchedAt = page?.fetchedAtEpochMs
    const timestamp = fetchedAt && Number.isFinite(fetchedAt) && fetchedAt > 0
      ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(fetchedAt)
      : ''
    return `${timestamp ? `截至 ${timestamp}，` : ''}座位系统显示今日剩余${rows.join('、')}。${page?.cached ? '这是最近一次读取的记录。' : ''}`
  } }
}
