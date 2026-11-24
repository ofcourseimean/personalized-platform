import { invoke } from '@tauri-apps/api/core'
import type { CompanionComputerSettings } from '../domain/models'

export interface ComputerActionRequest {
  action: string
  params?: Record<string, unknown>
}

const isTauriRuntime = () => '__TAURI_INTERNALS__' in window
const nativeFailures: Record<string, string> = {
  APP_OPEN_FAILED: 'Windows 未能把目标交给默认应用。',
  FILE_PATH_INVALID: '请提供完整的本地路径。',
  FILE_PATH: '目标路径无法访问，可能已被移动。',
  FILE_PARENT: '目标所在的目录不存在或无法访问。',
  FILE_SCOPE_DENIED: '目标不在已授权的读取范围内。',
  FILE_SENSITIVE_CONFIRMATION_REQUIRED: '该路径涉及敏感资料，需要明确确认。',
  FILE_LIST_NOT_DIRECTORY: '目标不存在或不是文件夹。',
  FILE_SEARCH_INVALID: '请提供有效的文件名关键词。',
  FILE_LIST: 'Windows 无法列出这个目录。',
  COMPUTER_PERMISSION_DENIED: '此目标已被明确禁止。',
  COMPUTER_CONFIRMATION_REQUIRED: '此操作需要在当前界面确认。',
  COMPUTER_PERMISSION_DISABLED: '电脑能力已关闭。',
  TAKEOVER_BUSY: '请先暂停或停止正在运行的接管。',
}

export function createComputerService(policy: CompanionComputerSettings) {
  return {
    async execute(request: ComputerActionRequest, confirmed: boolean) {
      if (!isTauriRuntime()) throw new Error('电脑能力仅在 Windows 桌面版可用')
      if (request.action === 'takeover_prepare') {
        if (!policy.enabled) throw new Error('请先开启电脑能力')
        const goal = typeof request.params?.goal === 'string' ? request.params.goal.slice(0, 2000) : ''
        window.dispatchEvent(new CustomEvent('yiyu:prepare-computer-takeover', { detail: { goal } }))
        return { prepared: true, requiresUserStart: true, started: false }
      }
      try {
        return await invoke<unknown>('computer_execute', { request, policy, confirmed })
      } catch (error) {
        if (typeof error === 'string') {
          const code = error.split(':', 1)[0]
          if (Object.hasOwn(nativeFailures, code)) throw new Error(nativeFailures[code])
        }
        throw error
      }
    },
    async stopAll() {
      window.dispatchEvent(new Event('yiyu:computer-stop'))
      if (!isTauriRuntime()) return { stopped: false }
      return invoke<unknown>('computer_emergency_stop')
    },
    async status() {
      if (!isTauriRuntime()) return { recordings: [], processes: [] }
      return invoke<unknown>('computer_status')
    },
    async detectFfmpeg() {
      if (!isTauriRuntime()) return undefined
      return invoke<string | null>('computer_detect_ffmpeg')
    },
  }
}
