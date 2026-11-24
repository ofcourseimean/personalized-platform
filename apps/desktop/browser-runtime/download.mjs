import { randomUUID } from 'node:crypto'
import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const maxBytes = 16 * 1024 * 1024
const formats = {
  'application/pdf': ['pdf', '%PDF-'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx', '504b0304'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx', '504b0304'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx', '504b0304'],
}

async function getDocument(element, { href, maxBytes }) {
  if (!element.isConnected || element.href !== href || new URL(href).origin !== location.origin) return null
  const response = await fetch(href, { mode: 'same-origin', redirect: 'error', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(18000) })
  if (!response.body) return null
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (response.status !== 200 || response.url !== href.split('#')[0] || !['application/pdf', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(mime) || Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel().catch(() => {})
    return null
  }
  const reader = response.body.getReader(), chunks = []
  let bytes = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > maxBytes) return null
      for (let i = 0; i < value.length; i += 8192) chunks.push(String.fromCharCode(...value.subarray(i, i + 8192)))
    }
    return { mime, base64: btoa(chunks.join('')), disposition: (response.headers.get('content-disposition') ?? '').slice(0, 1024) }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

function filename(href, disposition, mime) {
  const decoded = value => { try { return decodeURIComponent(value) } catch { return value } }
  const attachment = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition)
  const fallback = new URL(href).pathname.split('/').at(-1) ?? ''
  const candidate = (attachment ? attachment[1] ? decoded(attachment[1]) : attachment[2] : decoded(fallback)).trim()
  const extension = candidate.split('.').at(-1)?.toLowerCase()
  const format = Object.hasOwn(formats, mime) ? formats[mime] : Object.values(formats).find(([ext]) => extension === ext)
  if (!format) throw new Error('BROWSER_DOWNLOAD_FAILED')
  const base = candidate.replace(/\.[a-z\d]+$/i, '').replace(/[^\p{L}\p{N} _().-]/gu, '_').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 70)
  return { name: `网页-${base || '附件'}.${format[0]}`, signature: format[1] }
}

export async function saveDocument(ref, root) {
  let response
  try { response = await ref.handle.evaluate(getDocument, { href: ref.info.href, maxBytes }) }
  catch { throw new Error('BROWSER_DOWNLOAD_FAILED') }
  if (!response || typeof response.base64 !== 'string' || response.base64.length > Math.ceil(maxBytes / 3) * 4 || typeof response.disposition !== 'string') throw new Error('BROWSER_DOWNLOAD_FAILED')
  const { name, signature } = filename(ref.info.href, response.disposition, response.mime)
  const bytes = Buffer.from(response.base64, 'base64')
  const prefix = signature === '%PDF-' ? Buffer.from(signature) : Buffer.from(signature, 'hex')
  if (bytes.length <= prefix.length || bytes.length > maxBytes || !bytes.subarray(0, prefix.length).equals(prefix)) throw new Error('BROWSER_DOWNLOAD_FAILED')
  const id = randomUUID(), staging = join(root, `.${id}`)
  await mkdir(root, { recursive: true })
  const metadata = await lstat(root)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('BROWSER_DOWNLOAD_FAILED')
  await mkdir(staging)
  try {
    const path = join(staging, name)
    await writeFile(path, bytes, { flag: 'wx' })
    if (process.platform === 'win32') await writeFile(`${path}:Zone.Identifier`, '[ZoneTransfer]\r\nZoneId=3\r\n', { flag: 'wx' })
    await rename(staging, join(root, id))
    return { id, name, bytes: bytes.length }
  } catch (error) {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    throw new Error('BROWSER_DOWNLOAD_FAILED', { cause: error })
  }
}
