import type { BrowserSettings, BrowserSiteProfile } from '../../domain/browser'

export interface BrowserSiteCardData extends BrowserSiteProfile {
  label: string
  purpose: string
  abilities: string[]
  aliases?: string[]
  preferred?: string
  publicSearch?: boolean
}
export const normalizeSiteName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '')

export const websitePresets: readonly BrowserSiteCardData[] = [
  { origin: 'https://mails.tsinghua.edu.cn', label: '清华邮箱', role: 'mail', purpose: '学校邮箱账户', abilities: ['检查未读邮件', '搜索指定邮件'], preferred: '未指定邮箱账户时的默认邮箱' },
  { origin: 'https://mail.google.com', label: 'Gmail', role: 'mail', purpose: '个人备用邮箱账户', abilities: ['检查未读邮件', '搜索指定邮件'] },
  { origin: 'https://learn.tsinghua.edu.cn', label: '清华网络学堂', aliases: ['网络学堂'], role: 'portal', purpose: '学校的课程、课件和作业系统', abilities: ['查找老师上传的资料', '查作业和截止时间', '查看课程通知'], preferred: '未指定课程平台时的默认课件与作业来源' },
  { origin: 'https://pro.yuketang.cn', label: '雨课堂', role: 'portal', purpose: '课堂互动和课程资料平台', abilities: ['查课堂通知', '查随堂测验', '找本课程课堂资料'] },
  { origin: 'https://seat.lib.tsinghua.edu.cn', label: '清华图书馆座位系统', aliases: ['图书馆座位系统'], role: 'portal', purpose: '学校图书馆自习座位管理系统', abilities: ['查看指定馆区和时间的可预约座位', '准备指定馆区和时间的座位预约'] },
  { origin: 'https://in.closed.social', label: '华清大学课程攻略', aliases: ['课程攻略'], role: 'general', purpose: '课程攻略和往年考试资源分享站', abilities: ['根据课程找往年试卷、题目和答案', '下载当前网页所选的受支持试卷附件'], preferred: '找往年试卷的默认站点' },
  { origin: 'https://www.bilibili.com', label: 'B 站', aliases: ['哔哩哔哩', 'Bilibili'], role: 'general', purpose: '公开视频和主播平台', abilities: ['搜索与主题匹配的视频', '打开选中的视频页面', '查询主播与直播状态'], publicSearch: true },
  { origin: 'https://annas-archive.pk', label: 'Anna’s Archive', aliases: ['安娜档案', "Anna's Archive"], role: 'general', purpose: '图书目录与版本检索', abilities: ['按书名、作者或版本查找图书条目'], preferred: '明确要求查找一本书或书的版本时的默认站点', publicSearch: true },
  { origin: 'https://www.hltv.org', label: 'HLTV', role: 'general', purpose: 'Counter-Strike 电竞资讯、赛事与统计', abilities: ['查 CS 战队和队员', '查赛事赛程和赛果', '查选手及比赛数据'], preferred: 'CS 战队、选手、赛事和赛果的默认来源', publicSearch: true },
  { origin: 'https://hltv.org', label: 'HLTV', role: 'general', purpose: 'Counter-Strike 电竞资讯、赛事与统计', abilities: ['查 CS 战队和队员', '查赛事赛程和赛果', '查选手及比赛数据'], preferred: 'CS 战队、选手、赛事和赛果的默认来源', publicSearch: true },
  { origin: 'https://github.com', label: 'GitHub', role: 'general', purpose: '代码仓库与项目协作平台', abilities: ['查指定仓库的 Issue、PR 与 CI 状态'] },
  { origin: 'https://chatgpt.com', label: 'ChatGPT', role: 'general', purpose: '对话应用', abilities: ['打开用户指定的 ChatGPT 页面'] },
]

export function siteDirectory(settings: BrowserSettings) {
  const cards = new Map<string, BrowserSiteCardData>()
  for (const preset of websitePresets) {
    // The canonical site is a setup suggestion. A previously authorized bare
    // host stays eligible only when it is selected as an exact origin.
    if (preset.origin === 'https://hltv.org' && !settings.sites.includes(preset.origin)) continue
    if (preset.origin === 'https://www.hltv.org' && !settings.sites.includes(preset.origin) && settings.sites.includes('https://hltv.org')) continue
    cards.set(preset.origin, preset)
  }
  for (const profile of settings.profiles ?? []) {
    if (!settings.sites.includes(profile.origin)) continue
    const preset = cards.get(profile.origin)
    const purpose = profile.purpose ?? preset?.purpose
    const abilities = profile.abilities ?? preset?.abilities
    if (!purpose || !abilities?.length) continue
    cards.set(profile.origin, { ...preset, ...profile, label: profile.label || preset?.label || new URL(profile.origin).hostname, purpose, abilities })
  }
  return [...cards.values()]
}
