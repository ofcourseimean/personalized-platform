import { useState, useSyncExternalStore } from 'react'
import { Cloud, Laptop } from 'lucide-react'
import {
  privateConversation,
  setPrivateConversation,
  subscribeConversationPrivacy,
} from './conversationPrivacy'
import './conversationPrivacy.css'
export function ConversationPrivacyToggle({ disabled = false }: { disabled?: boolean }) {
  const local = useSyncExternalStore(subscribeConversationPrivacy, privateConversation, () => true)
  const [error, setError] = useState('')
  const Icon = local ? Laptop : Cloud
  return (
    <span className="companion-privacy-control">
      <button
        type="button"
        className="companion-privacy-toggle"
        aria-label="仅本机会话"
        aria-pressed={local}
        disabled={disabled}
        title={
          local
            ? '聊天记录保留在本机。点击切换普通会话。'
            : '普通聊天可在已配对设备间加密同步。点击切换本机会话。'
        }
        onClick={() => {
          try {
            setPrivateConversation(!local)
            setError('')
          } catch {
            setError('会话设置未保存')
          }
        }}
      >
        <Icon size={13} strokeWidth={1.7} aria-hidden="true" />
        <span aria-hidden="true">{local ? '本机' : '普通'}</span>
      </button>
      {error && <span className="companion-privacy-error" role="alert">{error}</span>}
    </span>
  )
}
