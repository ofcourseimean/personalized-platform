import { useId, useState } from 'react'
import { useLibraryStore } from '../../state/useLibraryStore'
import { siteDirectory } from './siteDirectory'

export function BrowserSiteRoutingSettings({ onChooseSite }: { onChooseSite: (origin: string) => void }) {
  const settings = useLibraryStore(state => state.data.companion.browser)
  const selectId = useId()
  const [selection, setSelection] = useState('')
  if (!settings) return null
  const proposals = siteDirectory(settings).filter(card => !settings.sites.includes(card.origin))
  const proposal = proposals.find(card => card.origin === selection)
  return <details className="browser-site-options browser-site-routing">
    <summary>网站用途与智能选站<small>{settings.semanticRouting ? '已开启' : '可选'}</small></summary>
    <div className="browser-site-option-body">
      <BrowserSmartRouting />
      {proposals.length > 0 && <>
        <label htmlFor={selectId}>选一个预设网站</label>
        <div className="browser-add-site">
          <select id={selectId} value={proposal?.origin ?? ''} onChange={event => setSelection(event.target.value)}>
            <option value="">选择网站</option>
            {proposals.map(card => <option key={card.origin} value={card.origin}>{card.label}</option>)}
          </select>
          <button type="button" disabled={!proposal} onClick={() => { if (proposal) onChooseSite(proposal.origin) }}>填入下方地址</button>
        </div>
        {proposal && <p className="browser-note">{proposal.abilities.join('、')}</p>}
      </>}
    </div>
  </details>
}

export function BrowserSmartRouting() {
  const enabled = useLibraryStore(state => state.data.companion.browser?.semanticRouting === true)
  return <label className="browser-cached-login">
    <input type="checkbox" checked={enabled}
      onChange={event => useLibraryStore.getState().setCompanionBrowser({ semanticRouting: event.target.checked })} />
    <span>按网站用途自动选站<small>向模型发送脱敏请求和候选网站用途，选中后核对本机授权。</small></span>
  </label>
}
