export interface PageEvidenceRequest {
  origin: string
  tabId: number
  observationId: string
  phrase: string
}

const normalized = (value: string) => value.normalize('NFKC').replace(/\s+/gu, '').toLowerCase()
const unsafe = /(?:密码|验证码|令牌|密钥|password|passcode|bank.?card|Bearer\s|sk-[\da-z]{12,}|忽略.*(?:指令|规则))/iu

export function extractPageEvidence(goal: string, text: string, raw: string) {
  const phrase = raw.trim()
  const match = normalized(phrase)
  if (match.length < 2 || match.length > 80 || /[\p{Cc}]/u.test(phrase) || unsafe.test(phrase)
    || !normalized(goal).includes(match)) {
    throw new Error('页面证据的查找词必须来自本轮用户请求。')
  }
  const lines = text.split(/\r?\n/u).map(line => line.trim()).filter(Boolean)
  const excerpts = new Set<string>()
  for (const [index, line] of lines.entries()) {
    if (line.length > 480 || unsafe.test(line) || !normalized(line).includes(match)) continue
    const context = [line]
    const next = lines[index + 1]
    if (next && next.length <= 120 && !unsafe.test(next)
      && /^(?:\d{1,4}[.年月日:/ -]|今天|明天|昨天|截止|发布|状态|可用|暂无|剩余)/u.test(next)) context.push(next)
    excerpts.add(context.join(' · '))
    if (excerpts.size >= 3) break
  }
  return [...excerpts]
}

export const escapePageText = (value: string) => value.replace(/[\r\n\u2028\u2029]/gu, ' ').replace(/([\\\x60*_[\]<>])/gu, '\\$1')
