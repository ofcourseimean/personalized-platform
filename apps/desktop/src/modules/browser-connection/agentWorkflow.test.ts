import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { createSeedLibrary } from '../../domain/seed'
import { bilibiliSetupSites } from '../../domain/browser'
import { useLibraryStore } from '../../state/useLibraryStore'
import { sendCompanionTurn } from '../companion/companionConversation'
import { clearLiveStatusTarget } from '../companion/liveStatusSession'
import { browserDateRange } from './parameters'
import type { AgentModelRequest } from '../companion/agent/types'
const mock=vi.hoisted(()=>({native:vi.fn(),generate:vi.fn()}))
vi.mock('@tauri-apps/api/core',()=>({invoke:mock.native}))
vi.mock('../../infrastructure/companionProvider',()=>({createCompanionProvider:()=>({id:'fixture-cloud',generate:mock.generate,testConnection:async()=>''})}))
vi.mock('../../infrastructure/libraryRepository',()=>({libraryRepository:{save:vi.fn(async()=>{})}}))
const origin='https://example.com'
beforeEach(()=>{
  mock.native.mockReset();mock.generate.mockReset()
  clearLiveStatusTarget('main:private');clearLiveStatusTarget('desktop:private')
  vi.stubGlobal('__TAURI_INTERNALS__',{})
  const data=createSeedLibrary();data.settings.trust.externalAiProcessing=true;data.companion.browser={enabled:true,backend:'managed',sites:[origin],interactionSites:[origin]}
  useLibraryStore.setState({data})
})
afterEach(()=>vi.unstubAllGlobals())
it('checks the named streamer through public tools with all five Bilibili domains connected', async () => {
  const data = useLibraryStore.getState().data
  data.companion.browser!.sites = [...bilibiliSetupSites]
  data.companion.permissions.internet = true
  const anchorName = '天才美少女卡莎'
  const roomUrl = 'https://live.bilibili.com/1733394496'
  mock.native.mockImplementation(async (command, args) => {
    if (command === 'web_search') {
      expect(args.query).toBe(`B站 "${anchorName}" 直播间`)
      return [{ title: `${anchorName} - 哔哩哔哩直播`, url: roomUrl, snippet: '与实时状态无关的搜索摘要' }]
    }
    expect(command).toBe('public_web_live_status')
    expect(args).toMatchObject({ roomUrl, expectedName: anchorName })
    return { roomUrl, anchorName, status: 'live', fetchedAtEpochMs: Date.now(), sourceUrls: [], untrusted: true }
  })
  const reply = await sendCompanionTurn('看看B站天才美少女卡莎开播了没')
  expect(mock.native.mock.calls.map(([command]) => command)).toEqual(['web_search', 'public_web_live_status'])
  expect(mock.generate).not.toHaveBeenCalled()
  expect(reply).toMatch(/^「天才美少女卡莎」正在直播。/)
  expect(reply).not.toMatch(/目标网站|搜索摘要|https:/)
  mock.native.mockClear()
  expect(await sendCompanionTurn('查询是否开播')).toMatch(/^「天才美少女卡莎」正在直播。/)
  expect(mock.native.mock.calls.map(([command]) => command)).toEqual(['web_search', 'public_web_live_status'])
  mock.native.mockClear()
  const desktop = { conversationChannel: 'desktop' as const }
  expect(await sendCompanionTurn('查询是否开播', desktop)).toBe('你想查哪位主播？告诉我直播昵称就可以。')
  expect(mock.native).not.toHaveBeenCalled()
  expect(await sendCompanionTurn('天才美少女卡莎', desktop)).toMatch(/^「天才美少女卡莎」正在直播。/)
  expect(mock.native.mock.calls.map(([command]) => command)).toEqual(['web_search', 'public_web_live_status'])
  expect(mock.generate).not.toHaveBeenCalled()
})

it('keeps followed-live queries on the selected managed browser', async () => {
  const data = useLibraryStore.getState().data
  data.companion.browser!.sites = [...bilibiliSetupSites]
  data.companion.permissions.internet = true
  mock.native.mockImplementation(async (command, args) => {
    if (command === 'managed_browser_configure') return { epoch: 3 }
    expect(command).toBe('managed_browser_request')
    expect(args.request).toMatchObject({ kind: 'followed_live', origin: 'https://live.bilibili.com' })
    return { verified: true, privateBrowser: true, data: { loggedIn: true, complete: true, checked: 1, rooms: [{ roomId: 42, name: '虚构主播', liveStatus: 1 }] } }
  })
  expect(await sendCompanionTurn('我关注的B站主播有谁在开播')).toContain('虚构主播')
  expect(mock.native.mock.calls.map(([command]) => command)).toEqual(['managed_browser_configure', 'managed_browser_request'])
  expect(mock.generate).not.toHaveBeenCalled()
})

it('shows the actual configured backend for an explicit connection check', async () => {
  const data = useLibraryStore.getState().data
  data.companion.permissions.internet = true
  mock.native.mockImplementation(async (command) => ({
    backend: command === 'managed_browser_configure' ? 'managed' : undefined,
    enabled: true, online: true, paired: true, epoch: 3,
  }))
  expect(await sendCompanionTurn('检查浏览器连接状态')).toContain('小鱼专用浏览器已开启')
  delete data.companion.browser!.backend
  expect(await sendCompanionTurn('检查浏览器连接状态')).toContain('Edge 扩展已连接')
  expect(mock.native.mock.calls.map(([command]) => command)).toEqual(['managed_browser_configure', 'browser_bridge_status'])
  expect(mock.generate).not.toHaveBeenCalled()
})

it('blocks browser diagnostics offered by the model without a resolved target', async () => {
  mock.generate.mockImplementation(async (request: AgentModelRequest) => {
    expect(request.tools?.some(tool => tool.name.startsWith('browser.'))).toBe(false)
    return { type: 'tool_call', call: { id: 'unsolicited', name: 'browser.status', arguments: {} } }
  })
  expect(await sendCompanionTurn('确认一下开播信息')).toBe('你想查哪位主播？告诉我直播昵称就可以。')
  expect(mock.generate).toHaveBeenCalledOnce()
  expect(mock.native).not.toHaveBeenCalled()
})

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
