export function attachmentDate(name: string) {
  const date = /\b(20\d{2})[-./年](0?[1-9]|1[0-2])[-./月](0?[1-9]|[12]\d|3[01])(?:日|\b)/u.exec(name)
  if (!date) return undefined
  const [, year, month, day] = date
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const timestamp = Date.parse(iso)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(iso) ? iso : undefined
}

export function assertAttachmentChoice(goal: string, elementId: string, controls: Array<{ id: string; operation: string; name?: string }>) {
  const attachments = controls.filter(control => control.operation === 'download')
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()
  const filenames = normalize(goal).match(/[\p{L}\p{N}_().-]+\.(?:pdf|docx|xlsx|pptx)\b/gu) ?? []
  const named = filenames.length ? attachments.filter(control => filenames.some(name => normalize(control.name ?? '').includes(name.trim()))) : []
  if (filenames.length && !named.some(control => control.id === elementId)) throw new Error('当前页面没有这个文件名的可核验下载链接。')
  if (!/(?:最新|最近|newest|latest)/iu.test(goal)) return
  const choices = named.length ? named : attachments
  if (choices.length < 2) return
  const dates = choices.map(control => ({ id: control.id, date: attachmentDate(control.name ?? '') }))
  if (dates.some(choice => !choice.date)) throw new Error('当前页面有多个附件，有些链接没有明确日期。请提供文件名，或先把页面筛选到要下载的资料。')
  const newest = dates.map(item => item.date!).sort().at(-1)
  if (dates.filter(item => item.date === newest).length !== 1 || !dates.some(item => item.id === elementId && item.date === newest)) {
    throw new Error('选中的附件无法确认为当前列表中唯一日期最新的一份。请提供文件名或打开具体的资料页。')
  }
}
