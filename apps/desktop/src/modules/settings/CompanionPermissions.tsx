import { LockKeyhole, Music2, ShieldCheck } from 'lucide-react'
import { useLibraryStore } from '../../state/useLibraryStore'
import { CompanionCapabilityPanel } from './CompanionCapabilityPanel'

const readPermissions = [
  ['todos', '待办', '读取待办、周期完成记录与休假日', '待办'],
  ['calendar', '日历事务', '读取日历中自行添加的事务', '日历事务'],
  ['courses', '课表', '读取课程、周次、教师与地点', '课表'],
  ['dailyQuestions', '朝问', '读取最近保存的每日问题', '朝问'],
  ['diary', '日记', '读取日记标题、摘要和正文', '日记'],
  ['mood', '情绪记录', '读取每日以及周、月情绪回望', '情绪'],
  ['records', '人物、地点与时间线', '资料概览与关联信息', '资料概览'],
  ['memories', '伙伴记忆', '读取明确授权保留的记忆', '记忆'],
  ['answerBook', '答案之书收藏', '读取主动收藏的问题与答案', '答案收藏'],
  ['experiences', '经历册', '读取作品与足迹，写入时沿用确认规则', '经历册'],
  ['assets', '素材库元数据', '读取文件名、类型和说明', '素材库元数据'],
  ['musicContext', '正在播放的音乐', '读取播放摘要，播放控制属于低风险界面操作', '播放信息'],
] as const

export function CompanionPermissions() {
  const { data, setCompanionPermissions } = useLibraryStore()
  const { permissions, agentAudit } = data.companion

  return <section className="settings-section intelligence-section">
    <div className="settings-title"><ShieldCheck /><div><h3>程序内读写</h3><p>管理小鱼能查看哪些内容，以及什么时候确认写入。</p></div></div>
    <div className="permission-list">
      <div><ShieldCheck /><span><strong>完整程序权限</strong><small>允许已接入的程序内查询及写入；加密解锁、删除、密钥和电脑权限单独保护</small></span><button type="button" aria-label="允许伙伴访问整个程序" aria-pressed={permissions.fullAccess} className={permissions.fullAccess ? 'switch on' : 'switch'} onClick={() => setCompanionPermissions({ fullAccess: !permissions.fullAccess })}><i /></button></div>
      <div><ShieldCheck /><span><strong>允许写入</strong><small>完整程序权限关闭时，使用此项控制写入</small></span><button type="button" aria-label="允许伙伴提出写入操作" aria-pressed={permissions.writeActions} className={permissions.writeActions ? 'switch on' : 'switch'} onClick={() => setCompanionPermissions({ writeActions: !permissions.writeActions })}><i /></button></div>
      <label className="permission-policy-row"><ShieldCheck /><span><strong>写入确认方式</strong><small>平衡模式自动执行新建待办、日历事务、完成待办和情绪记录</small></span><select value={permissions.writePolicy} onChange={event => setCompanionPermissions({ writePolicy: event.target.value as typeof permissions.writePolicy })}><option value="balanced">平衡（推荐）</option><option value="always_ask">始终询问</option></select></label>
    </div>

    <details className="permission-scope-group">
      <summary>按资料类别授权</summary>
      <div className="permission-list">
        {readPermissions.map(([key, title, description, label]) => <div key={key}>
          {key === 'musicContext' ? <Music2 /> : <ShieldCheck />}
          <span><strong>{title}</strong><small>{description}</small></span>
          <button type="button" aria-label={`允许伙伴读取${label}`} aria-pressed={permissions[key]}
            className={permissions[key] ? 'switch on' : 'switch'} onClick={() => setCompanionPermissions({ [key]: !permissions[key] })}><i /></button>
        </div>)}
      </div>
    </details>
    <details className="permission-scope-group">
      <summary><span>允许读取的作品</span><small>已授权 {permissions.workIds.length} 项</small></summary>
      <div className="permission-scopes">{data.works.filter(work => !work.deletedAt).map(work => <label key={work.id}>
        <input type="checkbox" checked={permissions.workIds.includes(work.id)} onChange={event => setCompanionPermissions({
          workIds: event.target.checked ? [...permissions.workIds, work.id] : permissions.workIds.filter(id => id !== work.id),
        })} />
        <span>{work.encrypted && <LockKeyhole size={12} />} {work.title}</span><small>{work.encrypted ? '仍需本次会话许可' : '只读授权'}</small>
      </label>)}</div>
    </details>
    <details className="permission-scope-group">
      <summary><span>只允许特定章节</span><small>已授权 {permissions.chapterIds.length} 项</small></summary>
      <div className="permission-scopes">{Object.values(data.chapters).filter(chapter => !chapter.deletedAt).map(chapter => {
        const work = data.works.find(item => item.id === chapter.workId)
        return <label key={chapter.id}>
          <input type="checkbox" checked={permissions.chapterIds.includes(chapter.id)} onChange={event => setCompanionPermissions({
            chapterIds: event.target.checked ? [...permissions.chapterIds, chapter.id] : permissions.chapterIds.filter(id => id !== chapter.id),
          })} />
          <span>{chapter.title}</span><small>{work?.title ?? '未知作品'} · 最多读取前 4000 字</small>
        </label>
      })}</div>
    </details>
    <details className="permission-scope-group">
      <summary><span>最近调用记录</span><small>{agentAudit.length} 条</small></summary>
      <div className="agent-audit-list">{agentAudit.slice(-12).reverse().map(entry => <div key={entry.id}>
        <span><strong>{entry.toolName}</strong><small>{new Date(entry.timestamp).toLocaleString()} · {entry.permissionDecision === 'allowed' ? '已允许' : '已拒绝'} · {entry.durationMs} ms</small>
          {entry.target && <em>{entry.confirmed ? '本次确认' : '按规则执行'} · {entry.target}</em>}{entry.errorDetail && <em>{entry.errorDetail}</em>}</span>
        <b className={entry.resultStatus === 'success' ? 'ok' : 'failed'}>{entry.resultStatus === 'success' ? '成功' : entry.errorCode ?? '失败'}</b>
      </div>)}{!agentAudit.length && <p>还没有调用记录。</p>}</div>
    </details>
    <CompanionCapabilityPanel />
  </section>
}
