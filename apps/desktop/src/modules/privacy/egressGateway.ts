import type { LibraryData } from '../../domain/models'
import type { AgentMessage, AgentModelProvider, AgentModelRequest, AgentModelResponse } from '../companion/agent/types'
import { PrivacySession } from './privacySession'
import type { PrivacyFinding, PrivacyReviewRequest } from './types'
import { projectBrowserRequest } from '../browser-connection/modelView'
import { findingsRequiringConfirmation } from './reviewPolicy'

interface EgressGatewayOptions {
  assertAllowed?: () => void
  /** Program-owned current query authority, rechecked after sanitizing. Never a model argument or a bypass for secrets. */
  authorizeSanitizedQuery?: () => void
  /** Explicit site setting to review each browser model send. */
  reviewEachRequest?: boolean
  trust: LibraryData['settings']['trust']
  destination: string
  purpose: string
  requestReview?: (request: PrivacyReviewRequest) => Promise<boolean>
}

function countFindings(findings: PrivacyFinding[]) {
  const counts: PrivacyReviewRequest['findingCounts'] = {}
  for (const { kind } of findings) counts[kind] = (counts[kind] ?? 0) + 1
  return counts
}

export async function protectOutboundText(text: string, options: EgressGatewayOptions) {
  options.assertAllowed?.()
  if (!options.trust.outboundProtection && !options.authorizeSanitizedQuery) return text
  const result = new PrivacySession(options.trust.privateDictionary).sanitize(text)
  options.authorizeSanitizedQuery?.()
  const needsReview = options.trust.outboundReviewMode === 'strict' || findingsRequiringConfirmation(result.findings).length > 0
  if (!options.authorizeSanitizedQuery && needsReview && options.requestReview) {
    const allowed = await options.requestReview({
      destination: options.destination,
      purpose: options.purpose,
      findingCounts: countFindings(result.findings),
      sanitizedPreview: result.text.slice(0, 800),
    })
    if (!allowed) throw new Error('已取消发送，内容没有离开本机。')
  }
  options.assertAllowed?.()
  return result.text
}

function mapStrings(value: unknown, transform: (text: string) => string): unknown {
  if (typeof value === 'string') return transform(value)
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, transform))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, transform)]))
  return value
}

function restoreResponse(response: AgentModelResponse, session: PrivacySession): AgentModelResponse {
  if (response.type === 'text') return { ...response, text: session.restore(response.text) }
  return { ...response, call: { ...response.call, arguments: mapStrings(response.call.arguments, (text) => session.restore(text)) } }
}

function protectModelRequest(request: AgentModelRequest, session: PrivacySession) {
  const { messages, ...metadata } = request
  const findings: PrivacyFinding[] = []
  let sensitivePreview: string | undefined

  const redact = (text: string) => {
    const result = session.sanitize(text)
    findings.push(...result.findings)
    if (sensitivePreview === undefined && findingsRequiringConfirmation(result.findings).length) {
      sensitivePreview = result.text
    }
    return result.text
  }

  const protectedMessages = messages.map((message) => {
    let content = message.content
    if (message.role === 'tool') {
      // Inspect raw JSON leaf strings before escaping can hide credentials.
      let value: unknown
      try { value = JSON.parse(content) } catch { return mapStrings(message, redact) as AgentMessage }
      content = JSON.stringify(mapStrings(value, redact))
    }
    return mapStrings({ ...message, content }, redact) as AgentMessage
  })
  const protectedMetadata = mapStrings(metadata, redact) as Omit<AgentModelRequest, 'messages'>
  return { request: { ...protectedMetadata, messages: protectedMessages }, findings, sensitivePreview }
}

export function createPrivacyProtectedProvider(provider: AgentModelProvider, options: EgressGatewayOptions): AgentModelProvider {
  if (provider.id === 'mock') return provider
  const session = new PrivacySession(options.trust.privateDictionary)
  let reviewed = false
  const reviewedContent = new Set<string>()
  const reviewedSensitive = new Set<string>()
  return {
    id: provider.id,
    testConnection: () => provider.testConnection(),
    async generate(request, generationOptions) {
      options.assertAllowed?.()
      const projection = projectBrowserRequest(request)
      const contentKeys = projection.reviewKeys.filter((key) => !reviewedContent.has(key))
      const { request: protectedRequest, findings, sensitivePreview } = protectModelRequest(projection.request, session)
      options.authorizeSanitizedQuery?.()
      const sensitiveKeys = findingsRequiringConfirmation(findings).map(({ kind, value }) => `${kind}:${value}`)
      const explicitReview = !options.authorizeSanitizedQuery && options.reviewEachRequest
      if (contentKeys.length && !options.requestReview) throw new Error('私人正文需要发送前审查；当前界面无法确认，内容没有发送。')
      if (explicitReview && !options.requestReview) throw new Error('已开启浏览器发送前确认；当前界面无法确认，内容没有发送。')
      const policyReview = !options.authorizeSanitizedQuery && (
        explicitReview ||
        (!reviewed && options.trust.outboundReviewMode === 'strict') ||
        sensitiveKeys.some((key) => !reviewedSensitive.has(key))
      )
      if (options.requestReview && (contentKeys.length || policyReview)) {
        const previewSource = contentKeys.length?protectedRequest.messages.filter(message=>message.role==='tool'&&message.content.includes('"contentReview":true')).map(message=>{
          const result=JSON.parse(message.content) as {data:{data:{text?:string}}};return result.data.data.text??''
        }).join('\n\n——\n\n'):sensitivePreview ?? protectedRequest.messages.findLast(message=>message.role==='tool'||message.role==='user')?.content ?? ''
        const allowed = await options.requestReview({ destination: options.destination, purpose: contentKeys.length?'理解网页正文节选（每段最多2000字，单独确认发送）':options.purpose, findingCounts: countFindings(findings), sanitizedPreview: contentKeys.length?previewSource:previewSource.slice(0,800),...(contentKeys.length?{fullPreview:true}:{}) })
        if (!allowed) throw new Error('已取消发送，内容没有离开本机。')
        reviewed = true
        contentKeys.forEach((key) => reviewedContent.add(key))
        // Reviewing a page excerpt only covers what its dedicated preview shows.
        if (!contentKeys.length) sensitiveKeys.forEach((key) => reviewedSensitive.add(key))
      }
      let rawStream = ''; let emitted = ''
      options.assertAllowed?.()
      const response = await provider.generate(protectedRequest, {
        ...generationOptions,
        onTextDelta: generationOptions?.onTextDelta ? (delta) => {
          options.assertAllowed?.()
          rawStream += delta
          const open = rawStream.lastIndexOf('['); const close = rawStream.lastIndexOf(']')
          const stableRaw = open > close ? rawStream.slice(0, open) : rawStream
          const restored = session.restore(stableRaw)
          if (restored.length > emitted.length) generationOptions.onTextDelta?.(restored.slice(emitted.length))
          emitted = restored
        } : undefined,
      })
      options.assertAllowed?.()
      if (generationOptions?.onTextDelta) {
        const restored = session.restore(rawStream)
        if (restored.length > emitted.length) generationOptions.onTextDelta(restored.slice(emitted.length))
      }
      return restoreResponse(response, session)
    },
  }
}
