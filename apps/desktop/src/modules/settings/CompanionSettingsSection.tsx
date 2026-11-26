import { CheckCircle2, KeyRound, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createCompanionProvider, deleteCompanionKey, hasCompanionKey, storeCompanionKey } from '../../infrastructure/companionProvider'
import { useLibraryStore } from '../../state/useLibraryStore'
import { assertExternalAiAllowed } from '../trust/trustPolicy'

export function CompanionSettingsSection() {
  const { data, setCompanionProvider } = useLibraryStore()
  const [message, setMessage] = useState('DeepSeek 仅连接官方 api.deepseek.com；自定义 Provider 暂不联网。')
  const [key, setKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const onlineProvider = data.companion.provider.providerId !== 'mock'
  useEffect(() => { void hasCompanionKey().then(setKeySaved) }, [])

  const chooseProvider = (providerId: 'mock' | 'deepseek' | 'custom') => {
    if (providerId === 'deepseek') setCompanionProvider({ providerId, endpoint: 'https://api.deepseek.com', model: 'deepseek-chat' })
    else setCompanionProvider({ providerId })
  }
  const saveKey = async () => {
    try {
      await storeCompanionKey(key)
      setKey('')
      setKeySaved(true)
      setMessage('对话模型 API Key 已由 Windows 安全存储保护。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '密钥保存失败')
    }
  }
  const checkProvider = async () => {
    try {
      assertExternalAiAllowed(data.companion.provider.providerId, data.settings.trust, 'companion')
      setMessage(await createCompanionProvider(data.companion.provider).testConnection())
    }
    catch (error) { setMessage(error instanceof Error ? error.message : '配置检查失败') }
  }

  return <section className="settings-section intelligence-section">
    <div className="settings-title"><Sparkles /><div><h3>对话模型</h3><p>用于对话、想法工坊和任务规划。</p></div></div>
    <div className="settings-subsection">
      <label className="setting-row"><div><strong>服务提供方</strong><span>DeepSeek 已支持对话与 Tool Calling</span></div><select value={data.companion.provider.providerId} onChange={(event) => chooseProvider(event.target.value as 'mock' | 'deepseek' | 'custom')}><option value="mock">本地 Mock（离线）</option><option value="deepseek">DeepSeek</option><option value="custom">其他兼容 Provider（暂不联网）</option></select></label>
      {onlineProvider && <><label className="setting-row"><div><strong>服务地址</strong><span>{data.companion.provider.providerId === 'deepseek' ? '仅允许 DeepSeek 官方地址' : '等待单独授权与协议适配'}</span></div><input readOnly={data.companion.provider.providerId === 'deepseek'} value={data.companion.provider.endpoint} placeholder="https://…" onChange={(event) => setCompanionProvider({ endpoint: event.target.value })} /></label><label className="setting-row"><div><strong>模型 ID</strong><span>DeepSeek 默认 deepseek-chat</span></div><input value={data.companion.provider.model} onChange={(event) => setCompanionProvider({ model: event.target.value })} /></label><div className="secret-setting"><KeyRound /><input type="password" autoComplete="off" value={key} placeholder={keySaved ? '对话 Key 已安全保存；输入可替换' : '输入对话模型 API Key'} onChange={(event) => setKey(event.target.value)} /><button disabled={!key} onClick={() => void saveKey()}>{keySaved ? '替换' : '保存'}</button>{keySaved && <button title="删除对话模型密钥" onClick={() => void deleteCompanionKey().then(() => { setKeySaved(false); setMessage('对话模型 API Key 已删除。') })}><Trash2 size={14} /></button>}</div></>}
      <div className="provider-test"><button className="ghost-button" onClick={() => void checkProvider()}><CheckCircle2 size={14} />检查配置</button><span>{message}</span></div>
    </div>
  </section>
}
