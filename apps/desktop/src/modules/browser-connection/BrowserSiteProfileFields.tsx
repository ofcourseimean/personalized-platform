import { useEffect,useState } from 'react'
import { useLibraryStore } from '../../state/useLibraryStore'
import { browserPageUrl,type BrowserSiteProfile,type BrowserSiteRole } from '../../domain/browser'
import { websiteRole } from './siteProfile'
import { websitePresets } from './siteDirectory'
export function BrowserSiteProfileFields({site}:{site:string}){
  const profile=useLibraryStore(state=>state.data.companion.browser?.profiles?.find(item=>item.origin===site))
  const preset = websitePresets.find(item => item.origin === site)
  const allowed=useLibraryStore(state=>state.data.companion.browser?.interactionSites?.includes(site)===true)
  const preferred=useLibraryStore(state=>state.data.companion.browser?.preferredSites)
  const browser=useLibraryStore(state=>state.data.companion.browser)
  const [label,setLabel]=useState(profile?.label??''),[entry,setEntry]=useState(profile?.entryUrl??''),[error,setError]=useState('')
  const [purpose, setPurpose] = useState(profile?.purpose ?? preset?.purpose ?? '')
  const [abilities, setAbilities] = useState((profile?.abilities ?? preset?.abilities ?? []).join('\n'))
  useEffect(()=>{setLabel(profile?.label??'');setEntry(profile?.entryUrl??'')},[profile?.label,profile?.entryUrl])
  useEffect(() => {
    setPurpose(profile?.purpose ?? preset?.purpose ?? '')
    setAbilities((profile?.abilities ?? preset?.abilities ?? []).join('\n'))
  }, [profile?.purpose, profile?.abilities, preset])
  const save=(changes:Partial<BrowserSiteProfile>)=>{
    try{
      const current=useLibraryStore.getState().data.companion.browser?.profiles??[]
      const existing = current.find(item => item.origin === site)
      const next={origin:site,role:websiteRole(site,existing),...existing,...changes}
      if(next.entryUrl)next.entryUrl=browserPageUrl(next.entryUrl,site)
      const defaults={...useLibraryStore.getState().data.companion.browser?.preferredSites}
      if(changes.role)for(const key of ['mail','portal','general'] as const)if(key!==changes.role&&defaults[key]===site)delete defaults[key]
      useLibraryStore.getState().setCompanionBrowser({profiles:[...current.filter(item=>item.origin!==site),next],preferredSites:defaults});setError('')
    }catch(reason){setError(reason instanceof Error?reason.message:'网站配置无效')}
  }
  const toggle=()=>{
    const current=useLibraryStore.getState().data.companion.browser?.interactionSites??[]
    useLibraryStore.getState().setCompanionBrowser({interactionSites:allowed?current.filter(item=>item!==site):[...current,site]})
  }
  const siteRole=websiteRole(site,profile),role=siteRole==='portal'?'portal':'mail'
  const preferenceRole=Object.entries(preferred??{}).find(([,value])=>value===site)?.[0] as BrowserSiteRole|undefined
  const multiple=browser?.sites.filter(value=>websiteRole(value,browser.profiles?.find(item=>item.origin===value))===siteRole).length!==1
  return <div className="browser-site-profile">
    {browser?.backend==='managed'&&<label className="browser-cached-login"><input type="checkbox" aria-label={`允许 ${new URL(site).hostname} 用已填凭据登录`} checked={browser.cachedLoginSites?.includes(site)===true} onChange={event=>{const current=useLibraryStore.getState().data.companion.browser?.cachedLoginSites??[];useLibraryStore.getState().setCompanionBrowser({cachedLoginSites:event.target.checked?[...new Set([...current,site])]:current.filter(value=>value!==site)})}}/><span>允许用已填凭据登录<small>仅同网站登录按钮；每轮最多一次，不读取或填写密码</small></span></label>}
    <label className="browser-cached-login"><input type="checkbox" aria-label={`允许 ${new URL(site).hostname} 页面导航与检索`} checked={allowed} onChange={toggle}/><span>页面导航与检索<small>允许查看分组、翻页和站内搜索</small></span></label>
    <div className="browser-profile-fields"><label>用途<select aria-label={`${new URL(site).hostname} 网站用途`} value={siteRole} onChange={event=>save({role:event.target.value as BrowserSiteRole})}><option value="general">普通网站</option><option value="mail">邮箱</option><option value="portal">通知 / 门户</option></select></label><label>名称<input aria-label={`${new URL(site).hostname} 网站称呼`} value={label} placeholder="可不填" maxLength={60} onChange={event=>setLabel(event.target.value)} onBlur={()=>save({label:label.trim()})}/></label></div>
    {(siteRole==='mail'||siteRole==='portal'||preferenceRole)&&(multiple||preferenceRole)&&<label className="browser-cached-login"><input type="checkbox" aria-label={`${new URL(site).hostname} 默认查询网站`} checked={Boolean(preferenceRole)} onChange={event=>{const current={...useLibraryStore.getState().data.companion.browser?.preferredSites};if(event.target.checked)current[role]=site;else if(preferenceRole)delete current[preferenceRole];useLibraryStore.getState().setCompanionBrowser({preferredSites:current})}}/>{(preferenceRole??role)==='mail'?'默认邮箱':'默认通知 / 门户'}</label>}
    <details className="browser-entry-options"><summary>指定查询入口<small>通常无需设置</small></summary><input aria-label={`${new URL(site).hostname} 查询入口`} value={entry} placeholder={`${site}/`} onChange={event=>setEntry(event.target.value)} onBlur={()=>save({entryUrl:entry.trim()||undefined})}/></details>
    <details className="browser-entry-options browser-site-routing"><summary>站点用途<small>{preset || profile?.purpose ? '已填写' : '可填写'}</small></summary>
      <div className="browser-install-body">
        <label>这个网站是什么<input maxLength={160} value={purpose} onChange={event => setPurpose(event.target.value)}
          onBlur={() => { if (purpose.trim() !== (profile?.purpose ?? preset?.purpose ?? '')) save({ purpose: purpose.trim() }) }} /></label>
        <label>可在这里完成的任务（每行一项）<textarea rows={4} maxLength={605} value={abilities}
          onChange={event => setAbilities(event.target.value)}
          onBlur={() => { if (abilities.trim() !== (profile?.abilities ?? preset?.abilities ?? []).join('\n')) save({ abilities: abilities.split('\n').map(line => line.trim()).filter(Boolean) }) }} /></label>
      </div>
    </details>
    {error&&<small role="alert">{error}</small>}
  </div>
}
