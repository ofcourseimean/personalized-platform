import { useEffect,useState } from 'react'
import { ShieldCheck,Square } from 'lucide-react'
import { useLibraryStore } from '../../../state/useLibraryStore'
import { browserNative } from '../native'
import { configureManagedBrowser,stopManagedBrowser,finishManagedBrowserLogin,type ManagedBrowserStatus } from './native'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { BrowserRecordingCard } from '../recording/BrowserRecordingCard'
import { BrowserSmartRouting } from '../BrowserSiteRoutingSettings'
import { ManagedBrowserSites } from './ManagedBrowserSites'

export function ManagedBrowserSection(){
  const settings=useLibraryStore(state=>state.data.companion.browser)
  const [status,setStatus]=useState<ManagedBrowserStatus>(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const enabled=settings?.enabled===true
  const [clearSession,setClearSession]=useState(false)
  useEffect(()=>{
    if(!('__TAURI_INTERNALS__' in window))return
    let disposed=false
    const refresh=()=>void browserNative<ManagedBrowserStatus>('managed_browser_status').then(value=>{if(!disposed)setStatus(value)}).catch(()=>{})
    refresh();const timer=window.setInterval(refresh,3000);return()=>{disposed=true;clearInterval(timer)}
  },[])
  const run=async(action:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await action()}catch(reason){setError(reason instanceof Error?reason.message:'浏览器操作失败')}finally{setBusy(false)}}
  const login=async(origin:string)=>{
    const state=await configureManagedBrowser(),entry=settings?.profiles?.find(profile=>profile.origin===origin)?.entryUrl??origin
    await browserNative('managed_browser_login',{origin,url:entry,expectedEpoch:state.epoch});setStatus({...state,mode:'login'})
    setNotice('请在专用窗口直接使用网站密码登录；只有网站要求时才需额外认证。完成后点“结束登录”，自动续查当前未过期问题。日常Edge登录不会自动继承。')
  }
  const visibleSession = status?.mode === 'login' || status?.mode === 'recording'
  const stop = () => void run(async () => {
    await stopManagedBrowser()
    setStatus(undefined)
    setNotice('已停止专用浏览器，本机登录会话保留。')
  })
  return <div className="browser-connection-body browser-direct">
    <div className="setting-row"><div><strong>允许小鱼浏览网站</strong><span>可在下面添加小鱼能访问的网站。</span></div><button type="button" className={enabled?'switch on':'switch'} aria-label="启用小鱼专用浏览器" aria-pressed={enabled} onClick={()=>useLibraryStore.getState().setCompanionBrowser({enabled:!enabled})}><i/></button></div>
    {settings && enabled && <>
      {visibleSession && <div className="browser-connection-status"><span className="browser-status-dot online"/><span>{status?.mode === 'login' ? '专用登录窗口已打开' : '正在记录操作示范'}</span><button type="button" disabled={busy} onClick={stop}><Square size={12} />停止</button></div>}
      {status?.mode==='login'&&<div className="browser-managed-login"><strong>登录完成后，回到这里继续</strong><p className="browser-note">可直接使用网站的密码登录；只有网站要求时才需额外认证。小鱼不读取登录窗口。“结束登录”后会自动续查尚未过期的当前问题，重新核对页面，不把登录当作查询成功。</p><button type="button" disabled={busy} onClick={()=>void run(async()=>{const result=await finishManagedBrowserLogin();setStatus(result.status);setNotice(result.resumed?'登录窗口已关闭，正在后台重新检查刚才的问题。':result.waiting?'登录窗口已关闭，回到原聊天界面后将自动续查；5分钟内有效。':'专用窗口已关闭。没有待续问题，之后可直接查询。')})}>结束登录 · 转为后台</button></div>}
      <ManagedBrowserSites settings={settings} busy={busy} run={run} login={login} notify={setNotice} />
      <BrowserRecordingCard />
      <details className="browser-install-options browser-advanced">
        <summary>选站与隐私</summary>
        <div className="browser-install-body">
          <BrowserSmartRouting />
          <label className="browser-cached-login"><input type="checkbox" checked={settings.confirmQueryEgress === true} onChange={event => useLibraryStore.getState().setCompanionBrowser({ confirmQueryEgress: event.target.checked })} /><span>每次发送脱敏结果前确认</span></label>
          <p className="browser-privacy-note"><ShieldCheck size={14} /><span>登录会话保存在本机。普通查询只向模型提供必要的控件语义；私人正文节选需要单独确认。</span></p>
          <div className="browser-actions">
            {!visibleSession && <button type="button" disabled={busy} onClick={stop}><Square size={12} />停止浏览器</button>}
            <button type="button" disabled={busy} onClick={() => setClearSession(true)}>清除专用浏览器登录</button>
          </div>
        </div>
      </details>
    </>}
    {notice&&<p className="browser-note" role="status">{notice}</p>}{error&&<p className="browser-note" role="alert">{error}</p>}
    {clearSession&&<ConfirmDialog title="清除专用浏览器登录？" subject="小鱼的独立本机会话" description="将停止专用浏览器并清除其中所有网站的登录、缓存与本机网页数据，无法恢复。已授权网站列表、日常Edge和资料库不会删除。" confirmLabel="确认清除" permanent onCancel={()=>setClearSession(false)} onConfirm={()=>void run(async()=>{await browserNative('managed_browser_clear_session',{confirmed:true});setClearSession(false);setStatus(undefined);setNotice('专用浏览器登录已清除，无法恢复。已授权网站保留，之后可重新登录。')})}/>}
  </div>
}
