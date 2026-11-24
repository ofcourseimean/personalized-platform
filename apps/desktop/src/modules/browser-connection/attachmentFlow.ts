import type { AgentToolCall, AgentToolResult } from '../companion/agent/types'

type Attachment = { name: string; path: string; directory: string; bytes: number }
type Destination = { path: string; label: string }

export class AttachmentFlow {
  private readonly goal: string
  private attachment?: Attachment
  private destinations: Destination[] = []
  private outcomes: string[] = []
  private pending?: AgentToolCall
  private finished = 0
  constructor(goal: string) { this.goal = goal }

  owns(call: AgentToolCall) { return call === this.pending }

  advance(call: AgentToolCall, result: AgentToolResult): { nextCall?: AgentToolCall; reply?: string } | undefined {
    if (this.owns(call) && this.pending) {
      const target = this.destinations[this.finished++]
      const receipt = result.data as { target?: string; status?: string; opened?: boolean } | undefined
      this.outcomes.push(result.success && receipt?.opened && receipt.status === 'submitted_to_default_handler' && receipt.target === target.path
        ? `已把${target.label}交给 Windows 打开。`
        : `${target.label}没有打开。${result.error?.message ?? 'Windows 未返回有效回执。'}`)
      return this.next()
    }
    if (call.name !== 'browser.act' || (call.arguments as { operation?: string })?.operation !== 'download') return
    // Stale references and blocked trials are handled by the browser flow.
    if (!result.success && ['BROWSER_STALE', 'BROWSER_ACTION_BLOCKED'].includes(result.error?.browserCode ?? '')) return
    if (!result.success) return { reply: `未能确认附件下载成功。${result.error?.message ?? '没有取得文件回执。'}` }
    const envelope = result.data as { verified?: boolean; data?: { actionStatus?: string; attachment?: Attachment } } | undefined
    const attachment = envelope?.data?.attachment
    if (envelope?.verified !== true || envelope.data?.actionStatus !== 'downloaded' || !attachment || typeof attachment.name !== 'string' || typeof attachment.directory !== 'string' || typeof attachment.path !== 'string' || !Number.isSafeInteger(attachment.bytes) || attachment.bytes <= 0
      || !/^(?:[a-z]:\\|\\\\)/iu.test(attachment.directory) || attachment.path !== `${attachment.directory}\\${attachment.name}` || !/^网页-[\p{L}\p{N} _().-]+\.(?:pdf|docx|xlsx|pptx)$/u.test(attachment.name)) return { reply: '收到的下载回执无法核验，请在网站上查看该附件。' }
    this.attachment = attachment
    const tail = (this.goal.split(/下载|\bdownload\b/iu).at(-1) ?? '').split(/(?:不(?:要|用|必|需要)?|别|无需|禁止|勿)\s*(?:再)?(?:打开|查看|显示)/u)[0]
    const openFolder = /(?:打开|查看|显示).{0,24}(?:文件夹|目录)|(?:文件夹|目录).{0,8}打开/iu.test(tail)
    const openFile = /^(?:.{0,15}?)(?:打开|open)(?:一下|它|文件|文档|附件|讲义)?(?=$|[，。,、\s]|然后|再|并)/iu.test(tail.trim())
    if (openFile) this.destinations.push({ path: attachment.path, label: '文档' })
    if (openFolder) this.destinations.push({ path: attachment.directory, label: '所在文件夹' })
    return this.next()
  }

  private next() {
    const target = this.destinations[this.finished]
    if (target) {
      this.pending = { id: `attachment-${crypto.randomUUID()}`, name: 'system.open', arguments: { target: target.path } }
      return { nextCall: this.pending }
    }
    this.pending = undefined
    return { reply: `已下载「${this.attachment!.name}」。${this.outcomes.join('')}\n\n文件保存在 ${this.attachment!.path}` }
  }
}
