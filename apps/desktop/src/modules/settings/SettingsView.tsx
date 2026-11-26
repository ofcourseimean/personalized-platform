import { Cat, Database, LockKeyhole, MonitorCog, Palette, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLibraryStore } from '../../state/useLibraryStore'
import { findSettingsPages, resolveSettingsPage, settingsGroups, type SettingsPage } from './settingsCatalog'
import { SettingsPageContent } from './SettingsPageContent'

const icons = { interface: Palette, companion: Cat, connections: MonitorCog, library: Database, security: LockKeyhole }
const storageKey = 'yiyu.settings.activeTab'

export function SettingsView() {
  const navigation = useLibraryStore(store => store.data.session.agentNavigation)
  const viewport = useRef<HTMLElement>(null)
  const [page, setPage] = useState<SettingsPage>(() => {
    try { return resolveSettingsPage(localStorage.getItem(storageKey)) ?? 'appearance' }
    catch { return 'appearance' }
  })
  const [query, setQuery] = useState('')
  const group = settingsGroups.find(group => group.pages.some(item => item.id === page)) ?? settingsGroups[0]
  const current = group.pages.find(item => item.id === page) ?? group.pages[0]
  const matches = findSettingsPages(query)

  function choose(next: SettingsPage) {
    setPage(next)
    setQuery('')
    try { localStorage.setItem(storageKey, next) } catch { /* In-memory selection still works. */ }
    viewport.current?.scrollTo?.({ top: 0 })
  }

  useEffect(() => {
    if (navigation?.destination !== 'settings') return
    const next = resolveSettingsPage(navigation.section)
    if (next) choose(next)
  }, [navigation])

  return <main ref={viewport} className="settings-view scroll-view">
    <header className="page-header settings-page-header">
      <h1>设置</h1>
      <div className="settings-finder">
        <form role="search" aria-label="设置内搜索" onSubmit={event => { event.preventDefault(); if (matches[0]) choose(matches[0].id) }}>
          <Search size={17} aria-hidden="true" />
          <input aria-label="查找设置" placeholder="查找设置…" value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Escape' && query) { event.stopPropagation(); setQuery('') } }} />
          {query && <button type="button" aria-label="清空设置搜索" onClick={() => setQuery('')}><X size={15} /></button>}
        </form>
        {query.trim() && <div className="settings-search-results">
          {matches.length ? matches.map(item => <button type="button" key={item.id} onClick={() => choose(item.id)}>{item.title}</button>)
            : <p role="status">没有找到相关设置。</p>}
        </div>}
      </div>
    </header>

    <div className="settings-workspace">
      <nav className="settings-side-nav" aria-label="设置分类">
        {settingsGroups.map(item => {
          const Icon = icons[item.id]
          return <button type="button" key={item.id} className={group.id === item.id ? 'active' : ''}
            aria-current={group.id === item.id ? 'true' : undefined} onClick={() => choose(item.id === group.id ? page : item.pages[0].id)}>
            <Icon aria-hidden="true" /><span>{item.title}</span>
          </button>
        })}
      </nav>
      <section className="settings-pane" aria-labelledby="settings-pane-title">
        <nav className="settings-page-nav" aria-label={`${group.title}的设置`}>
          {group.pages.map(item => <button type="button" key={item.id} aria-current={page === item.id ? 'page' : undefined}
            onClick={() => choose(item.id)}>{item.title}</button>)}
        </nav>
        <h2 id="settings-pane-title" className="settings-pane-title">{current.title}</h2>
        <div className="settings-pane-content" key={page}><SettingsPageContent page={page} /></div>
      </section>
    </div>
  </main>
}
