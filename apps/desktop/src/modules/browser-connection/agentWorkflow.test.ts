import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { createSeedLibrary } from '../../domain/seed'
import { useLibraryStore } from '../../state/useLibraryStore'
import { sendCompanionTurn } from '../companion/companionConversation'
import { browserDateRange } from './parameters'
import type { AgentModelRequest } from '../companion/agent/types'
const mock=vi.hoisted(()=>({native:vi.fn(),generate:vi.fn()}))
vi.mock('@tauri-apps/api/core',()=>({invoke:mock.native}))
vi.mock('../../infrastructure/companionProvider',()=>({createCompanionProvider:()=>({id:'fixture-cloud',generate:mock.generate,testConnection:async()=>''})}))
vi.mock('../../infrastructure/libraryRepository',()=>({libraryRepository:{save:vi.fn(async()=>{})}}))
const origin='https://example.com'
beforeEach(()=>{
  mock.native.mockReset();mock.generate.mockReset()
  vi.stubGlobal('__TAURI_INTERNALS__',{})
  const data=createSeedLibrary();data.settings.trust.externalAiProcessing=true;data.companion.browser={enabled:true,backend:'managed',sites:[origin],interactionSites:[origin]}
  useLibraryStore.setState({data})
})
afterEach(()=>vi.unstubAllGlobals())
it('plans model-interpreted dates and sorting through normal tools without sending page bodies or native parameter provenance',async()=>{
  let phase=0
  mock.native.mockImplementation(async(name,args)=>{
    if(name==='managed_browser_configure')return {epoch:3}
    const r=args.request
    let value:unknown
    if(r.kind==='tabs')value=[{tabId:7,origin,title:'PRIVATE-ACCOUNT',url:origin+'/PRIVATE-PATH'}]
    else if(r.kind==='act'){
      expect(r.interaction.intent).toBeUndefined()
      expect(r.interaction.query).toBe(phase===0?browserDateRange('this_week').start:phase===1?browserDateRange('this_week').end:'从新到旧')
      phase++;value={tabId:7,origin,actionStatus:'dispatched'}
    }else value={tabId:7,origin,title:'PRIVATE-TITLE',url:origin+'/PRIVATE-PATH',observationId:crypto.randomUUID(),text:'通知 2 条\nPRIVATE-BODY\nfirst@example.com',loading:false,truncated:false,controls:[{id:crypto.randomUUID(),operation:phase<2?'fill':'select',name:phase===0?'开始日期（YYYY-MM-DD）':phase===1?'结束日期（YYYY-MM-DD）':'时间排序（从旧到新、从新到旧）'}]}
    return {verified:true,privateBrowser:true,untrusted:true,origin,fetchedAtEpochMs:Date.now(),data:value}
  })
  mock.generate.mockImplementation(async(request:AgentModelRequest)=>{
    const serialized=JSON.stringify(request);expect(serialized).not.toMatch(/PRIVATE-|first@example.com/)
    const page=JSON.parse([...request.messages].reverse().find(message=>message.role==='tool')!.content).data.data
    const control=page.controls[0]
    const boundary=phase===0?'start':'end'
    const args=phase<2?{origin,tabId:7,observationId:page.observationId,elementId:control.id,operation:'fill',query:browserDateRange('this_week')[boundary],intent:{source:'本周',kind:'date',range:'this_week',boundary}}:phase===2?{origin,tabId:7,observationId:page.observationId,elementId:control.id,operation:'select',query:control.choices[1].value,intent:{source:'最新的排前面',kind:'option'}}:{origin,tabId:7,observationId:page.observationId,quotes:['通知 2 条'],answer:'当前页面显示2条通知。'}
    return {type:'tool_call',call:{id:crypto.randomUUID(),name:phase<3?'browser.act':'browser.verify',arguments:args}}
  })
  const reply=await sendCompanionTurn(`查看 ${origin} 本周通知，最新的排前面`)
  expect(reply).toContain('2条通知');expect(phase).toBe(3);expect(mock.generate).toHaveBeenCalledTimes(4)
  expect(JSON.stringify([useLibraryStore.getState().data.companion.messages,useLibraryStore.getState().data.companion.agentAudit])).not.toMatch(/PRIVATE-|observationId|first@example.com/)
})

it('downloads a current attachment and delivers both open actions locally through the normal chat entry point',async()=>{
  const data=useLibraryStore.getState().data
  data.companion.browser!.profiles=[{origin,role:'portal',label:'网络学堂'}]
  data.companion.computer.enabled=true
  data.companion.computer.profile='trusted_workstation'
  const directory='C:\\PRIVATE-DIRECTORY'
  const path=`${directory}\\网页-课程.pdf`
  const opened:string[]=[]
  const observationId=crypto.randomUUID(),elementId=crypto.randomUUID()
  mock.native.mockImplementation(async(name,args)=>{
    if(name==='computer_execute'){
      expect(args.request.action).toBe('app_open')
      const target=args.request.params.target
      opened.push(target)
      return {opened:true,target,status:'submitted_to_default_handler'}
    }
    if(name==='managed_browser_configure')return {epoch:3}
    const request=args.request
    const value=request.kind==='tabs'?[{tabId:7,origin}]:request.kind==='act'?
      {tabId:7,origin,actionStatus:'downloaded',attachment:{name:'网页-课程.pdf',path,directory,bytes:123}}:
      {tabId:7,origin,observationId,text:'PRIVATE-BODY',controls:[{id:elementId,operation:'download',name:'PRIVATE-TITLE 2026-11-24'}]}
    return {verified:true,privateBrowser:true,untrusted:true,origin,data:value}
  })
  mock.generate.mockImplementation(async(request:AgentModelRequest)=>{
    expect(JSON.stringify(request)).not.toMatch(/PRIVATE-|computer_execute/)
    expect(request.tools.some(tool=>tool.name==='system.open')).toBe(false)
    return {type:'tool_call',call:{id:crypto.randomUUID(),name:'browser.act',arguments:{origin,tabId:7,observationId,elementId,operation:'download'}}}
  })
  const reply=await sendCompanionTurn('去网络学堂找这门课最新的讲义，下载后打开，再打开它所在的文件夹')
  expect(mock.generate).toHaveBeenCalledOnce()
  expect(opened,reply).toEqual([path,directory])
  expect(reply).toContain('已下载')
  expect(reply).toContain('已把所在文件夹交给 Windows 打开')
  expect(reply).not.toContain('本次执行结果')
  expect(JSON.stringify([useLibraryStore.getState().data.companion.messages,useLibraryStore.getState().data.companion.agentAudit])).not.toContain('PRIVATE-')
})

it('resolves a folder locally, asks about duplicates, and carries a selection in the same chat',async()=>{
  const data=useLibraryStore.getState().data
  const computer=data.companion.computer
  computer.enabled=true
  computer.profile='trusted_workstation'
  computer.grants=[{id:'fixture-root',targetKind:'directory',capability:'file_read',mode:'allow',target:'D:\\workspace',createdAt:''}]
  const paths=['D:\\workspace\\a\\家教','D:\\workspace\\b\\家教']
  mock.native.mockImplementation(async(name,args)=>{
    expect(name).toBe('computer_execute')
    if(args.request.action==='file_search'){
      expect(args.request.params).toMatchObject({path:'D:\\workspace',query:'家教',directoriesOnly:true})
      return {entries:paths.map(path=>({name:'家教',path,isDirectory:true})),complete:true}
    }
    expect(args.request.params).toEqual({target:paths[1],directory:true})
    return {target:paths[1],opened:true,status:'submitted_to_default_handler'}
  })
  const reply=await sendCompanionTurn('本地家教文件夹打开一下')
  expect(reply).toContain('候选文件夹')
  expect(mock.native).toHaveBeenCalledOnce()
  expect(await sendCompanionTurn('打开第二个')).toContain('交给 Windows 资源管理器')
  expect(mock.native).toHaveBeenCalledTimes(2)
  expect(mock.generate).not.toHaveBeenCalled()
  expect(useLibraryStore.getState().data.companion.messages).toEqual([])
})
