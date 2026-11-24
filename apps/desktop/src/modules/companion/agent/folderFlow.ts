import type { CompanionComputerSettings } from '../../../domain/models'
import type { AgentToolCall, AgentToolResult } from './types'

type Folder = { name: string; path: string }
type FolderRequest = { computer: CompanionComputerSettings; channel: string; policy: string; name: string; path?: string }
type Choice = { folders: Folder[]; expires: number; policy: string }
const choices = new Map<string, Choice>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const limit = 5
const normalize = (value: string) => value.replaceAll('/', '\\').replace(/[\\]+$/u, '').toLocaleLowerCase()
const absolute = /^(?:[a-z]:[\\/]|\\\\[^?\\][^\\]*\\)/iu

export function clearFolderChoice(channel: string) {
  choices.delete(channel)
  clearTimeout(timers.get(channel))
  timers.delete(channel)
}

export function prepareFolderFlow(message: string, computer: CompanionComputerSettings, channel: string) {
  const previous = choices.get(channel)
  clearFolderChoice(channel)
  const policy = JSON.stringify([computer.enabled, computer.profile, computer.grants])
  const selected = /^(?:打开|就选|选|用)?\s*第\s*([1-5一二三四五])\s*(?:个|项)?(?:文件夹)?[。！!]?$/u.exec(message.trim())
  const sameFolder = /^(?:再)?打开(?:一下)?(?:刚才|上次)(?:的|那个)?(?:文件夹|目录)[。！!]?$/u.test(message.trim())
  if ((selected || sameFolder && previous?.folders.length === 1) && previous && previous.expires > Date.now() && previous.policy === policy) {
    const index = selected ? (Number(selected[1]) || '一二三四五'.indexOf(selected[1]) + 1) - 1 : 0
    return new FolderFlow({ computer, channel, policy, name: '', path: previous.folders[index]?.path })
  }
  if (sameFolder) return new FolderFlow({ computer, channel, policy, name: '' })
  const text = message.trim().replace(/[。！!？?]+$/u, '')
  if (/(?:下载|删除|清空|移动|改名|复制|创建|然后|并且|为什么|如何|怎么|建议|不要|别打开|是否|的时候)/u.test(text)) return
  const match = /^(?:(?:请|帮我|替我|给我|麻烦你)\s*)*(?:打开(?:一下)?\s*(.+?)\s*(?:文件夹|目录)|(.+?)\s*(?:文件夹|目录)\s*打开(?:一下)?|打开(?:一下)?\s*([a-z]:[\\/].*[\\/]))$/iu.exec(text)
  if (!match) return
  const target = (match[1] ?? match[2] ?? match[3]).trim().replace(/^["“]|["”]$/gu, '').replace(/^本地(?:的)?\s*(?=.)/u, '')
  if (!target || target.length > 200 || /[\r\n]/u.test(target)) return
  return new FolderFlow({ computer, channel, policy, name: target, path: absolute.test(target) ? target : undefined })
}

export class FolderFlow {
  private readonly request: FolderRequest
  private readonly roots: string[]
  private readonly matches = new Map<string, Folder>()
  private complete = true
  private index = 0
  private failure?: string
  constructor(request: FolderRequest) {
    this.request = request
    const grants = new Map<string, { target: string; alias?: string }>()
    for (const grant of request.computer.grants) {
      if (grant.capability !== 'file_read' || grant.targetKind !== 'directory' || !absolute.test(grant.target)) continue
      const key = normalize(grant.target)
      if (grant.mode === 'allow') grants.set(key, grant)
      else grants.delete(key)
    }
    const allowed = [...grants.values()]
    const aliases = request.name ? allowed.filter(grant => typeof grant.alias === 'string' && normalize(grant.alias) === normalize(request.name)) : []
    if (aliases.length) {
      for (const { target } of aliases) this.matches.set(normalize(target), { path: target, name: request.name })
    }
    this.roots = aliases.length ? [] : allowed.map(grant => grant.target)
  }
  start(): { nextCall?: AgentToolCall; reply?: string } {
    if (!this.request.computer.enabled) return { reply: '请先在设置里开启电脑能力，再打开本地文件夹。' }
    if (this.request.path) return { nextCall: this.open(this.request.path) }
    if (!this.request.name) return { reply: '这个序号没有对应的文件夹。请再说一次要打开的目录名。' }
    if (this.matches.size) return this.resolve()
    if (!this.roots.length) return { reply: '请在电脑能力设置中授权一个目录的读取范围，再告诉我文件夹名或完整路径。' }
    if (this.roots.length > limit) this.complete = false
    return { nextCall: this.nextSearch() }
  }
  advance(call: AgentToolCall, result: AgentToolResult): { nextCall?: AgentToolCall; reply?: string; opened?: boolean } {
    if (call.name === 'system.open') {
      const data = result.data as { status?: string; target?: string } | undefined
      if (result.success && data?.status === 'submitted_to_default_handler' && data.target) {
        const name = data.target.split(/[\\/]/u).filter(Boolean).at(-1) ?? data.target
        this.remember([{ path: data.target, name }])
        return { reply: `已把「${name}」交给 Windows 资源管理器打开。`, opened: true }
      }
      return { reply: `文件夹未打开。${result.error?.message ?? 'Windows 没有返回可核验的打开回执。'}` }
    }
    const data = result.data as { entries?: Array<Folder & { isDirectory: boolean }>; complete?: boolean } | undefined
    if (!result.success || data?.complete !== true) this.complete = false
    if (!result.success) this.failure = result.error?.message
    if (result.success && Array.isArray(data?.entries)) for (const entry of data.entries) {
      if (entry.isDirectory && typeof entry.name === 'string' && typeof entry.path === 'string' && absolute.test(entry.path)) this.matches.set(normalize(entry.path), entry)
    }
    if (this.index < Math.min(this.roots.length, limit)) return { nextCall: this.nextSearch() }
    return this.resolve()
  }
  private resolve() {
    const found = [...this.matches.values()]
    const exact = found.filter(item => normalize(item.name) === normalize(this.request.name))
    const candidates = (exact.length ? exact : found).sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'))
    if (this.complete && candidates.length === 1) return { nextCall: this.open(candidates[0].path) }
    if (!candidates.length) return { reply: this.complete ? `已授权的目录中没有找到「${this.request.name}」。可以给我完整路径，或在设置中授权它所在的目录。` : `目录搜索未完成。${this.failure ?? '可以提供文件夹的完整路径，缩小查找范围。'}` }
    const folders = candidates.slice(0, limit)
    this.remember(folders)
    const list = folders.map((item, index) => `${index + 1}. ${item.path}`).join('\n')
    return { reply: `${this.complete ? '找到几个候选文件夹' : '找到以下候选，搜索范围有限'}。可以说“打开第一个”，或提供完整路径。\n\n${list}` }
  }
  private remember(folders: Folder[]) {
    const now = Date.now()
    for (const [key, value] of choices) if (value.expires <= now) clearFolderChoice(key)
    if (choices.size >= 4) clearFolderChoice(choices.keys().next().value!)
    choices.set(this.request.channel, { folders, expires: now + 300_000, policy: this.request.policy })
    timers.set(this.request.channel, setTimeout(() => clearFolderChoice(this.request.channel), 300_000))
  }
  private open(target: string) { return this.call('system.open', { target, directory: true }) }
  private nextSearch() { return this.call('file.search', { path: this.roots[this.index++], query: this.request.name, directoriesOnly: true }) }
  private call(name: string, args: Record<string, unknown>) { return { id: `folder-${crypto.randomUUID()}`, name, arguments: args } }
}
