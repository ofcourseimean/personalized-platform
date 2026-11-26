import { Globe2, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { deleteWebSearchKey, hasWebSearchKey, searchWeb, storeWebSearchKey, type WebSearchProviderId } from '../../infrastructure/webSearch'
import { useLibraryStore } from '../../state/useLibraryStore'

export function WebSearchSettings() {
  const { data, setCompanionPermissions, setWebSearchSettings } = useLibraryStore()
  const permissions = data.companion.permissions
  const [webDiagnostic, setWebDiagnostic] = useState('尚未测试联网查询。')
  const [webKey, setWebKey] = useState('')
  const [webKeySaved, setWebKeySaved] = useState(false)
  useEffect(() => {
    if (data.settings.webSearch.providerId === 'bing') { setWebKeySaved(false); return }
    void hasWebSearchKey(data.settings.webSearch.providerId).then(setWebKeySaved)
  }, [data.settings.webSearch.providerId])

  const chooseWebSearchProvider = (providerId: WebSearchProviderId) => {
    setWebSearchSettings({ providerId })
    setWebKey('')
    setWebDiagnostic('尚未测试联网查询。')
  }
  const saveWebKey = async () => {
    const provider = data.settings.webSearch.providerId
    if (provider === 'bing') return
    try {
      await storeWebSearchKey(provider, webKey)
      setWebKey('')
      setWebKeySaved(true)
      setWebDiagnostic('搜索服务 API Key 已由 Windows 安全存储保护。')
    } catch (error) { setWebDiagnostic(error instanceof Error ? error.message : '搜索密钥保存失败') }
  }
  const removeWebKey = async () => {
    const provider = data.settings.webSearch.providerId
    if (provider === 'bing') return
    await deleteWebSearchKey(provider)
    setWebKeySaved(false)
    setWebDiagnostic('搜索服务 API Key 已删除。')
  }
  const checkWebSearch = async () => {
    const started = performance.now()
    setWebDiagnostic('正在测试所选搜索服务……')

    try {
      const results = await searchWeb('一隅 软件', data.settings.webSearch)
      const actual = results[0]?.provider
      const route = actual === 'bing-fallback' ? 'Bing 应急降级' : actual === 'tencent' ? '腾讯云' : '博查'
      setWebDiagnostic(`${route} · ${results.length} 条结果 · ${Math.round(performance.now() - started)} ms`)
    } catch (error) {
      setWebDiagnostic(error instanceof Error ? error.message : 'WEB_SEARCH_UNKNOWN')
    }
  }

  return <section className="settings-section intelligence-section">
    <div className="settings-title"><Globe2 /><div><h3>公开搜索服务</h3><p>配置小鱼用来检索公开信息的服务。</p></div></div>
    <div className="permission-list">
          <div><Globe2 /><span><strong>联网查询</strong><small>允许小鱼使用公开搜索服务。查询词会经过外发保护。</small></span><button aria-label="允许伙伴联网查询" aria-pressed={permissions.internet} className={permissions.internet ? 'switch on' : 'switch'} onClick={() => setCompanionPermissions({ internet: !permissions.internet })}><i /></button></div>
          <div className="web-search-provider"><Globe2 /><span><strong>搜索服务</strong><small>腾讯云适合长期使用；博查可用于对比效果</small></span><select value={data.settings.webSearch.providerId} onChange={(event) => chooseWebSearchProvider(event.target.value as WebSearchProviderId)}><option value="tencent">腾讯云 · 轻量版</option><option value="bocha">博查 Web Search</option><option value="bing">Bing · 无密钥应急</option></select></div>
          {data.settings.webSearch.providerId !== 'bing' && <div className="web-search-key"><KeyRound /><span><strong>搜索 API Key</strong><small>{webKeySaved ? '已安全保存；输入新 Key 可替换' : '只保存在 Windows 安全存储中'}</small></span><span className="web-search-key-actions"><input type="password" autoComplete="off" value={webKey} placeholder={webKeySaved ? '已保存' : '输入 API Key'} onChange={(event) => setWebKey(event.target.value)} /><button disabled={!webKey} onClick={() => void saveWebKey()}>{webKeySaved ? '替换' : '保存'}</button>{webKeySaved && <button title="删除搜索服务密钥" onClick={() => void removeWebKey()}><Trash2 size={14} /></button>}</span></div>}
          <div className="web-search-fallback"><ShieldCheck /><span><strong>失败时应急降级</strong><small>所选服务不可用时临时使用 Bing RSS，并在诊断中明确标注</small></span><button aria-label="允许搜索失败时应急降级" aria-pressed={data.settings.webSearch.fallbackToBing} className={data.settings.webSearch.fallbackToBing ? 'switch on' : 'switch'} onClick={() => setWebSearchSettings({ fallbackToBing: !data.settings.webSearch.fallbackToBing })}><i /></button></div>
          <div className="web-search-diagnostic"><Globe2 /><span><strong>联网诊断</strong><small>{webDiagnostic}</small></span><button className="ghost-button quiet" onClick={() => void checkWebSearch()}>测试</button></div>
    </div>
  </section>
}
