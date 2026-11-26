import { useId, useState } from 'react'
import { Globe2, LogIn, X } from 'lucide-react'
import { bilibiliCreatorSites, bilibiliSetupSites, browserOrigin, browserPageUrl, type BrowserSettings } from '../../../domain/browser'
import { useLibraryStore } from '../../../state/useLibraryStore'
import { BrowserSiteProfileFields } from '../BrowserSiteProfileFields'
import { siteDirectory, websitePresets } from '../siteDirectory'
import { websiteRole } from '../siteProfile'

type Run = (action: () => Promise<void>) => Promise<void>
const bilibiliHome = 'https://www.bilibili.com'
const bilibiliReadSites = [bilibiliHome, ...bilibiliCreatorSites]
const bilibiliOrigins = new Set([...bilibiliSetupSites, ...bilibiliCreatorSites])

export function ManagedBrowserSites({ settings, busy, run, login, notify }: {
  settings: BrowserSettings
  busy: boolean
  run: Run
  login: (origin: string) => Promise<void>
  notify: (value: string) => void
}) {
  const [address, setAddress] = useState('')
  const scopeId = useId()
  const { sites } = settings
  const known = sites.filter(origin => bilibiliOrigins.has(origin))
  const ordinary = sites.filter(origin => !bilibiliOrigins.has(origin))
  const bilibiliReady = bilibiliReadSites.every(origin => sites.includes(origin))
  const proposals = siteDirectory(settings).filter(card => card.origin !== bilibiliHome && !sites.includes(card.origin))
  const addressIsBilibili = /^(?:https:\/\/)?www\.bilibili\.com\/?$/iu.test(address.trim())

  function add(additions: readonly string[], entry?: { origin: string; url: string }) {
    const store = useLibraryStore.getState()
    const current = store.data.companion.browser
    const next = [...new Set([...(current?.sites ?? []), ...additions])]
    if (next.length > 32) throw new Error('已达到 32 个网站地址的上限。请先移除不用的网站。')
    if (entry) {
      const previous = current?.profiles?.find(profile => profile.origin === entry.origin)
      store.setCompanionBrowser({
        sites: next,
        interactionSites: [...new Set([...(current?.interactionSites ?? []), entry.origin])],
        profiles: [...(current?.profiles ?? []).filter(profile => profile.origin !== entry.origin),
          { ...previous, origin: entry.origin, role: websiteRole(entry.origin, previous), entryUrl: entry.url }],
      })
    } else {
      store.setCompanionBrowser({ sites: next })
    }
    setAddress('')
    notify(entry ? '网站已添加。需要账号时，可在网站旁登录。' : 'B 站已添加，可以查找视频和创作者动态。')
  }

  function addAddress() {
    if (addressIsBilibili) return add(bilibiliReadSites)
    const raw = /^https:\/\//iu.test(address.trim()) ? address.trim() : `https://${address.trim()}`
    const url = new URL(raw)
    const origin = browserOrigin(url.origin)
    add([origin], { origin, url: browserPageUrl(url.href, origin) })
  }

  function remove(origins: readonly string[]) {
    const store = useLibraryStore.getState()
    store.setCompanionBrowser({ sites: store.data.companion.browser?.sites.filter(origin => !origins.includes(origin)) ?? [] })
  }

  const siteRow = (origin: string) => <ManagedSiteRow key={origin} origin={origin} settings={settings}
    onLogin={() => void run(() => login(origin))} onRemove={() => remove([origin])} busy={busy} />

  return <div className="managed-sites">
    <h3>常用网站</h3>
    <form className="browser-add-site" onSubmit={event => { event.preventDefault(); void run(async () => addAddress()) }}>
      <input aria-label="专用浏览器授权网站" value={address} onChange={event => setAddress(event.target.value)}
        placeholder="输入网站域名或 HTTPS 链接" autoComplete="off" spellCheck={false} aria-describedby={addressIsBilibili ? scopeId : undefined} />
      <button type="submit" disabled={busy || !address.trim()}>添加并授权浏览</button>
    </form>
    {addressIsBilibili && <p className="browser-note" id={scopeId}>会一并添加 B 站首页、用户搜索和个人空间。</p>}
    <div className="browser-site-presets">
      {proposals.length > 0 && <label><span>选择预设网站</span><select value="" onChange={event => setAddress(event.target.value)}>
        <option value="" disabled>选择网站</option>
        {proposals.map(card => <option key={card.origin} value={card.origin}>{card.label}</option>)}
      </select></label>}
      {!bilibiliReady && <div className="browser-quick-site">
        <span><strong>B 站</strong><small>首页、用户搜索和个人空间</small></span>
        <button type="button" disabled={busy} onClick={() => void run(async () => add(bilibiliReadSites))}>
          {known.length ? '补齐 B 站' : '添加 B 站'}
        </button>
      </div>}
    </div>
    {(ordinary.length > 0 || known.length > 0) && <div className="browser-sites">
      {known.length > 0 && <div className="browser-site-card">
        <div className="browser-site-top">
          <span className="browser-site-icon"><Globe2 size={17} /></span>
          <span className="browser-site-name"><strong>B 站</strong><small>{bilibiliReady ? '首页、用户搜索和个人空间' : '已添加部分页面'}</small></span>
          {sites.includes(bilibiliHome) && <button type="button" disabled={busy} onClick={() => void run(() => login(bilibiliHome))}><LogIn size={13} />登录</button>}
          <button type="button" className="browser-site-remove" aria-label="移除 B 站" onClick={() => remove(known)}><X size={16} /></button>
        </div>
        <details className="browser-site-options"><summary>管理 B 站地址<small>{known.length} 个</small></summary>
          <div className="browser-site-option-body browser-site-group">{known.map(siteRow)}</div>
        </details>
      </div>}
      {ordinary.map(siteRow)}
    </div>}
  </div>
}

function ManagedSiteRow({ origin, settings, busy, onLogin, onRemove }: {
  origin: string
  settings: BrowserSettings
  busy: boolean
  onLogin: () => void
  onRemove: () => void
}) {
  const host = new URL(origin).hostname
  const name = settings.profiles?.find(profile => profile.origin === origin)?.label
    || websitePresets.find(preset => preset.origin === origin)?.label
  return <div className="browser-site-card">
    <div className="browser-site-top">
      <span className="browser-site-icon"><Globe2 size={17} /></span>
      <span className="browser-site-name"><strong>{name || host}</strong>{name && <small>{host}</small>}</span>
      <button type="button" disabled={busy} onClick={onLogin}><LogIn size={13} />登录</button>
      <button type="button" className="browser-site-remove" aria-label={`撤销 ${origin}`} onClick={onRemove}><X size={16} /></button>
    </div>
    <details className="browser-site-options"><summary>网站选项</summary>
      <div className="browser-site-option-body"><BrowserSiteProfileFields site={origin} /></div>
    </details>
  </div>
}
