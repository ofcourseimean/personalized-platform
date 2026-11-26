export const settingsGroups = [
  {
    id: 'interface', title: '界面与功能', pages: [
      { id: 'appearance', title: '外观与写作', keywords: '主题 背景 壁纸 字体 布局 字数 音乐播放器' },
      { id: 'modules', title: '功能与导航', keywords: '模块 开关 入口顺序 排序 经历册 封面' },
    ],
  },
  {
    id: 'companion', title: '小鱼', pages: [
      { id: 'desktop', title: '桌面伙伴', keywords: '桌宠 形象 像素 摄像头 WebM 快捷键 唤醒名' },
      { id: 'voice', title: '语音与唤醒', keywords: '语音唤醒 朗读 麦克风 声音 ElevenLabs 语音识别 声纹' },
      { id: 'models', title: '模型服务', keywords: 'AI 伙伴 对话 图像 DeepSeek OpenRouter Provider API Key' },
      { id: 'memory', title: '记忆与性格', keywords: '小鱼 回应 气质 成长' },
      { id: 'activity', title: '音乐与心率', keywords: '听歌 歌词 播放 心率 手环 蓝牙' },
    ],
  },
  {
    id: 'connections', title: '网页与电脑', pages: [
      { id: 'browser', title: '浏览器', keywords: '网站 网页 Edge 小鱼专用浏览器 B站 B站创作者动态 哔哩哔哩 邮箱 登录 示范' },
      { id: 'computer', title: '电脑操作', keywords: '打开目录 文件夹 程序 Windows FFmpeg 录屏 屏幕 授权' },
      { id: 'search', title: '联网搜索', keywords: '搜索服务 联网查询 腾讯云 博查 Bing 诊断' },
    ],
  },
  {
    id: 'library', title: '数据与同步', pages: [
      { id: 'sync', title: '多端同步', keywords: '连接 云端 中枢 设备 邀请 手机 让一隅 随你同行' },
      { id: 'data', title: '数据管理', keywords: '备份 恢复 导入 导出 迁移 资源 曲库' },
    ],
  },
  {
    id: 'security', title: '隐私与安全', pages: [
      { id: 'privacy', title: '隐私与外发', keywords: '隐私与安全 脱敏 私密词典 聊天记录 外部 AI 发送前确认' },
      { id: 'permissions', title: '应用权限', keywords: '小鱼 访问 授权 能力 读取 写入 记录 审计' },
      { id: 'encryption', title: '作品加密', keywords: '加密 解锁 密码 vault' },
    ],
  },
] as const

export type SettingsPage = typeof settingsGroups[number]['pages'][number]['id']
export const settingsPages = settingsGroups.flatMap(group => [...group.pages])

const aliases: Record<string, SettingsPage> = {
  ai: 'models', intelligence: 'models', pet: 'desktop', online: 'browser', security: 'privacy',
}

export function resolveSettingsPage(value: string | null | undefined): SettingsPage | undefined {
  return settingsPages.find(page => page.id === value)?.id ?? (value && Object.hasOwn(aliases, value) ? aliases[value] : undefined)
}

export function findSettingsPages(raw: string) {
  const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '')
  const query = normalize(raw)
  if (!query) return []
  const terms = raw.trim().split(/\s+/u).map(normalize)
  return settingsPages.filter(page => {
    const index = normalize(page.title + ' ' + page.keywords)
    return index.includes(query) || terms.every(term => index.includes(term))
  })
}
