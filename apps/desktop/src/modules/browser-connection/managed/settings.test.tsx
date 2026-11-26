import { beforeEach,expect,it,vi } from 'vitest'
import { render,screen,fireEvent,waitFor } from '@testing-library/react'
import { createSeedLibrary } from '../../../domain/seed'
import { useLibraryStore } from '../../../state/useLibraryStore'
import { BrowserConnectionSection } from '../BrowserConnectionSection'
const native=vi.hoisted(()=>vi.fn())
vi.mock('../native',()=>({browserNative:native,configureBrowser:vi.fn()}))
vi.mock('../../../infrastructure/libraryRepository',()=>({libraryRepository:{save:vi.fn(async()=>{})}}))
beforeEach(()=>{native.mockReset();native.mockResolvedValue({epoch:4,mode:'background'});const data=createSeedLibrary();data.companion.browser={enabled:true,backend:'managed',sites:[]};useLibraryStore.setState({data})})

it('uses preset descriptions and requires the existing explicit add action before granting the site', async () => {
  render(<BrowserConnectionSection/>)
  fireEvent.click(screen.getByText('选站与隐私'))
  fireEvent.click(screen.getByRole('checkbox', { name: /按网站用途自动选站/u }))
  expect(useLibraryStore.getState().data.companion.browser?.semanticRouting).toBe(true)
  fireEvent.change(screen.getByLabelText('选择预设网站'), { target: { value: 'https://www.hltv.org' } })
  expect(screen.getByRole('textbox', { name: '专用浏览器授权网站' })).toHaveValue('https://www.hltv.org')
  expect(useLibraryStore.getState().data.companion.browser?.sites).toEqual([])
  expect(native).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '添加并授权浏览' }))
  await waitFor(() => expect(useLibraryStore.getState().data.companion.browser?.sites).toEqual(['https://www.hltv.org']))
  fireEvent.click(screen.getByText('网站选项', { exact: false }))
  const purpose = screen.getByRole('textbox', { name: '这个网站是什么' })
  expect(purpose).toHaveValue('Counter-Strike 电竞资讯、赛事与统计')
  fireEvent.change(purpose, { target: { value: '关注近期职业赛事' } })
  fireEvent.blur(purpose)
  expect(useLibraryStore.getState().data.companion.browser?.profiles?.[0]).toMatchObject({ purpose: '关注近期职业赛事' })
})
it('adds a clean entry in one place, infers mail purpose and never automatically opens a window',async()=>{
  render(<BrowserConnectionSection/>);expect(native).not.toHaveBeenCalled()
  fireEvent.change(screen.getByRole('textbox',{name:'专用浏览器授权网站'}),{target:{value:'https://mails.example.com/inbox'}})
  fireEvent.click(screen.getByRole('button',{name:'添加并授权浏览'}))
  await waitFor(()=>expect(useLibraryStore.getState().data.companion.browser).toMatchObject({sites:['https://mails.example.com'],interactionSites:['https://mails.example.com'],profiles:[{origin:'https://mails.example.com',role:'mail',entryUrl:'https://mails.example.com/inbox'}]}))
  expect(native).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('网站选项'))
  const loginPermission=screen.getByRole('checkbox',{name:'允许 mails.example.com 用已填凭据登录'})
  expect(loginPermission).not.toBeChecked()
  fireEvent.click(loginPermission)
  expect(useLibraryStore.getState().data.companion.browser!.cachedLoginSites).toEqual(['https://mails.example.com'])
  fireEvent.click(screen.getByRole('button',{name:'登录'}))
  await waitFor(()=>expect(native).toHaveBeenCalledWith('managed_browser_login',{origin:'https://mails.example.com',url:'https://mails.example.com/inbox',expectedEpoch:4}))
  fireEvent.click(await screen.findByRole('button',{name:'结束登录 · 转为后台'}))
  await waitFor(()=>expect(native).toHaveBeenCalledWith('managed_browser_finish_login',{expectedEpoch:4}))
})
it('preserves the site list when switching compatibility backend and only clears auth after explicit confirmation',async()=>{
  const origin='https://mails.example.com';useLibraryStore.getState().data.companion.browser!.sites=[origin]
  render(<BrowserConnectionSection/>)
  fireEvent.click(screen.getByText('选站与隐私'))
  fireEvent.click(screen.getByRole('button',{name:'清除专用浏览器登录'}))
  expect(screen.getByRole('dialog')).toBeInTheDocument();expect(native).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'先保留'}));expect(native).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'清除专用浏览器登录'}));fireEvent.click(screen.getByRole('button',{name:'确认清除'}))
  await waitFor(()=>expect(native).toHaveBeenCalledWith('managed_browser_clear_session',{confirmed:true}))
  expect(useLibraryStore.getState().data.companion.browser!.sites).toEqual([origin])
  fireEvent.change(screen.getByRole('combobox',{name:'浏览器工作方式'}),{target:{value:'edge'}});expect(useLibraryStore.getState().data.companion.browser!.backend).toBeUndefined()
  expect(useLibraryStore.getState().data.companion.browser!.sites).toEqual([origin])
})

it.each(['preset', 'address'])('adds B 站 once with exact read-only origins via %s', async entry => {
  const known = 'https://mails.example.com'
  useLibraryStore.getState().setCompanionBrowser({ sites: [known], interactionSites: [known] })
  render(<BrowserConnectionSection />)
  if (entry === 'preset') {
    fireEvent.click(screen.getByRole('button', { name: '添加 B 站' }))
  } else {
    fireEvent.change(screen.getByRole('textbox', { name: '专用浏览器授权网站' }), { target: { value: 'www.bilibili.com' } })
    expect(screen.getByText('会一并添加 B 站首页、用户搜索和个人空间。')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '添加并授权浏览' }))
  }
  await waitFor(() => expect(useLibraryStore.getState().data.companion.browser).toMatchObject({
    sites: [known, 'https://www.bilibili.com', 'https://search.bilibili.com', 'https://space.bilibili.com'],
    interactionSites: [known],
  }))
  expect(useLibraryStore.getState().data.companion.browser?.cachedLoginSites).toBeUndefined()
  expect(native).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('管理 B 站地址'))
  fireEvent.click(screen.getByRole('button', { name: '撤销 https://search.bilibili.com' }))
  expect(screen.getByRole('button', { name: '补齐 B 站' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: '移除 B 站' }))
  expect(useLibraryStore.getState().data.companion.browser?.sites).toEqual([known])
})
