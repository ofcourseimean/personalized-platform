import { BookMarked, Heart, Music2, Puzzle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LibraryData } from '../../domain/models'
import { navigationItems } from '../../app/moduleManifest'
import { useLibraryStore } from '../../state/useLibraryStore'
import { SettingsDetail } from './SettingsDetail'
import { CoverSourceSettings } from '../experiences/CoverSourceSettings'

const modules = [
  { id: 'ideas', label: '想法工坊', description: '水墨手稿，陪模糊念头慢慢成形', icon: <Sparkles /> },
  { id: 'writing', label: '写作', description: '作品、资料与时间线', icon: <span>文</span> },
  { id: 'answerBook', label: '答案之书', description: '偶然的一句话，陪你想一想', icon: <BookMarked /> },
  { id: 'fortune', label: '一隅签', description: '今日、恋爱、前程，每类每日一签', icon: <Sparkles /> },
  { id: 'experiences', label: '经历册', description: '作品、足迹与从夯到拉的个人排行', icon: <BookMarked /> },
  { id: 'truth', label: '真心话', description: '150 张问句卡，不记录回答', icon: <Heart /> },
  { id: 'music', label: '旧本地播放器', description: '保留原曲库，可在数据管理中打开', icon: <Music2 /> },
  { id: 'companion', label: 'AI 伙伴', description: '对话、桌面角色与受控任务', icon: <Sparkles /> },
] satisfies { id: LibraryData['settings']['modules'][number]['id']; label: string; description: string; icon: ReactNode }[]

export function ModuleSettings() {
  const { data, toggleModule, moveNavigation } = useLibraryStore()
  const visibleNavigation = data.settings.navigationOrder.filter(view => {
    const item = navigationItems.find(item => item.id === view)
    return item && !item.secondary
  })
  const moveVisible = (view: typeof visibleNavigation[number], direction: -1 | 1) => {
    const neighbor = visibleNavigation[visibleNavigation.indexOf(view) + direction]
    if (!neighbor) return
    const distance = Math.abs(data.settings.navigationOrder.indexOf(neighbor) - data.settings.navigationOrder.indexOf(view))
    for (let step = 0; step < distance; step++) moveNavigation(view, direction)
  }
  return <>
    <section className="settings-section"><div className="settings-title"><Puzzle /><div><h2>功能入口</h2><p>关闭只隐藏入口，不删除内容，也不停止已允许的播放。</p></div></div>
      <div className="settings-module-grid">{modules.map(item => {
        const enabled = data.settings.modules.find(value => value.id === item.id)?.enabled ?? true
        return <div className="settings-module-card" key={item.id}><i>{item.icon}</i><div><strong>{item.label}</strong><small>{item.description}</small></div><button aria-label={'启用' + item.label} aria-pressed={enabled} className={enabled ? 'switch on' : 'switch'} onClick={() => toggleModule(item.id)}><i /></button></div>
      })}</div>
      <details className="permission-scope-group settings-navigation-order">
        <summary>调整导航顺序</summary>
      <div className="navigation-order">{visibleNavigation.map((view, index) => <div key={view}><span>{navigationItems.find(item => item.id === view)?.label ?? view}</span><span><button aria-label={'上移' + view} disabled={index === 0} onClick={() => moveVisible(view, -1)}>↑</button><button aria-label={'下移' + view} disabled={index === visibleNavigation.length - 1} onClick={() => moveVisible(view, 1)}>↓</button></span></div>)}</div>
      </details>
    </section>
    <SettingsDetail title="经历册封面" description="配置封面来源"><CoverSourceSettings /></SettingsDetail>
  </>
}
