export const creatorSearchOrigin = 'https://search.bilibili.com'
export const creatorSpaceOrigin = 'https://space.bilibili.com'
export const creatorSites = [creatorSearchOrigin, creatorSpaceOrigin]

const usernameSelectors = '.h-name, .nickname, .space-header__nickname, .space-header__name, .space-header .name, #h-name'
const activitySelectors = '.bili-dyn-list__item, .bili-dyn-item'
const normalizedName = value => value.normalize('NFKC').replace(/[\u200b\ufeff]/gu, '').trim().toLowerCase()

export function creatorName(value) {
  if (typeof value !== 'string' || value !== value.trim() || [...value].length < 2 || [...value].length > 60
    || /[\p{Cc}<>@]|https?:|密码|令牌|验证码|password|Bearer\s/iu.test(value)) throw new Error('BROWSER_ARGUMENT')
  return value
}

export function creatorProfiles(links, name) {
  const profiles = new Map()
  for (const { labels, href } of links) {
    if (!labels.some(label => normalizedName(label) === normalizedName(name))) continue
    try {
      const url = new URL(href)
      if (url.origin !== creatorSpaceOrigin || url.username || url.password) continue
      const uid = /^\/([1-9]\d{0,18})(?:\/dynamic)?\/?$/u.exec(url.pathname)?.[1]
      if (uid) profiles.set(uid, `${creatorSpaceOrigin}/${uid}`)
    } catch { /* The page may contain other link types. */ }
  }
  return [...profiles.values()]
}

function readSearchPage() {
  const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden' && !node.closest('[hidden],[aria-hidden="true"]')
  const links = [...document.querySelectorAll('main a[href], #i_cecream a[href], #app a[href], a[href*="space.bilibili.com/"]')]
    .filter(visible).slice(0, 240).map(link => ({
      href: link.href,
      labels: [link.innerText, link.getAttribute('title'), link.getAttribute('aria-label')].filter(value => value && value.length <= 100),
    }))
  const empty = [...document.querySelectorAll('.search-empty, .vui-empty, .bili-search-empty')].some(node => visible(node) && /未找到|没有相关|暂无|没有找到/u.test(node.innerText))
  return { links, empty }
}

function searchResultsReady(name) {
  const normalize = value => String(value ?? '').normalize('NFKC').replace(/[\u200b\ufeff]/gu, '').trim().toLowerCase()
  const target = normalize(name)
  const visible = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  return [...document.querySelectorAll('a[href*="space.bilibili.com/"]')].some(link =>
    visible(link) && [link.innerText, link.getAttribute('title'), link.getAttribute('aria-label')].some(label => normalize(label) === target),
  ) || [...document.querySelectorAll('.search-empty, .vui-empty, .bili-search-empty')].some(node =>
    visible(node) && /未找到|没有相关|暂无|没有找到/u.test(node.innerText),
  )
}

function readSpacePage({ names, activities }) {
  const visible = node => !node.closest('[hidden],[inert],[aria-hidden="true"]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  const clean = (node, limit) => String(node?.innerText ?? '').replace(/\s+/gu, ' ').trim().slice(0, limit)
  const headings = [...document.querySelectorAll(names)].filter(visible).slice(0, 12).map(node => clean(node, 100))
  const cards = [...document.querySelectorAll(activities)].filter(node => !node.parentElement?.closest(activities) && visible(node)).slice(0, 16)
  const posts = cards.map(card => {
    const header = card.querySelector('.bili-dyn-item__header, .bili-dyn-title, .bili-dyn-item__author')
    const time = header?.querySelector('time, .bili-dyn-time, .bili-dyn-time__text, .bili-dyn-title__time')
      ?? card.querySelector('time, .bili-dyn-time, .bili-dyn-title__time')
    const content = card.querySelector('.bili-dyn-content__orig, .bili-rich-text, .opus-module-content, .bili-dyn-content')
    const badge = card.querySelector('.bili-dyn-item__top, .bili-dyn-card-top, .bili-dyn-item__pinned')
    return {
      published: clean(time, 64),
      timestamp: (time?.getAttribute('datetime') ?? time?.getAttribute('title') ?? '').slice(0, 64),
      text: clean(content, 800),
      pinned: Boolean(badge && visible(badge) && clean(badge, 30).includes('置顶')),
      media: Boolean(content?.querySelector('img, video, .bili-dyn-card-video, .bili-album, .bili-dyn-card-pub')),
    }
  })
  const message = [...document.querySelectorAll('.bili-dyn-list__empty, .bili-dyn-list-empty, .bili-dyn-empty, .empty-state')]
    .filter(visible).map(node => clean(node, 200)).join(' ')
  const empty = /暂无动态|还没有发布|没有动态/u.test(message)
  const login = !posts.length && /(?:登录后(?:可|才能)?查看|请先登录(?:后再)?查看|登录查看动态)/u.test(message || clean(document.body, 12000))
  return { headings, posts, empty, login }
}

export function activityTime(text, now) {
  // Video posts display the publication time and a separate action label.
  const [label] = String(text).trim().split(/\s*·\s*/u, 1)
  if (label === '刚刚') return now
  const ago = /^(\d{1,4})\s*(秒钟?|分钟|小时|天)前$/u.exec(label)
  if (ago) return now - Number(ago[1]) * (ago[2].startsWith('秒') ? 1000 : ago[2] === '分钟' ? 60000 : ago[2] === '小时' ? 3600000 : 86400000)
  const day = new Date(now + 8 * 3600000)
  const yesterday = /^昨天\s*(\d{1,2}):(\d{2})$/u.exec(label)
  if (yesterday && Number(yesterday[1]) < 24 && Number(yesterday[2]) < 60) return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - 1, Number(yesterday[1]) - 8, Number(yesterday[2]))
  const parts = /^(?:(\d{4})[-年/.])?(\d{1,2})[-月/.](\d{1,2})日?(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/u.exec(label)
  if (!parts) return /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/u.test(label) ? Date.parse(label) : NaN
  const [, year, month, date, hour = '0', minute = '0'] = parts
  const yearValue = Number(year ?? day.getUTCFullYear())
  const calendar = new Date(Date.UTC(yearValue, Number(month) - 1, Number(date), Number(hour), Number(minute)))
  if (calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(date) || Number(hour) > 23 || Number(minute) > 59) return NaN
  const time = calendar.getTime() - 8 * 3600000
  return !year && time > now ? Date.UTC(yearValue - 1, Number(month) - 1, Number(date), Number(hour) - 8, Number(minute)) : time
}

export function newestActivity(posts, now = Date.now()) {
  // A pinned entry alone does not establish the newest post. Read at least
  // one entry in the chronological list before comparing published times.
  if (!posts.some(post => !post.pinned)) return
  const times = posts.map(post => {
    const timestamp = activityTime(post.timestamp, now)
    return { post, time: Number.isFinite(timestamp) ? timestamp : activityTime(post.published, now) }
  })
  // Missing time on any visible post can hide a newer item.
  if (times.some(({ time }) => !Number.isFinite(time) || time <= 0 || time > now + 120000)) return
  const latest = times.sort((a, b) => b.time - a.time || Number(a.post.pinned) - Number(b.post.pinned))[0]
  return latest.post.published && (latest.post.text || latest.post.media) ? latest : undefined
}

export async function readCreatorActivity(journey, rawName, uid) {
  if (uid != null && (typeof uid !== 'string' || !/^[1-9]\d{0,18}$/u.test(uid))) throw new Error('BROWSER_ARGUMENT')
  const name = rawName != null ? creatorName(rawName) : undefined
  if (!uid && !name) throw new Error('BROWSER_ARGUMENT')
  let profile = uid ? `${creatorSpaceOrigin}/${uid}` : undefined
  if (!profile) {
    const search = new URL('/upuser', creatorSearchOrigin)
    search.searchParams.set('keyword', name)
    await journey.visit(search.href, { allowQuery: true })
    await journey.waitUntil(searchResultsReady, name)
    const discovery = await journey.read(readSearchPage)
    const matches = creatorProfiles(discovery.links, name)
    if (matches.length > 1) return { status: 'ambiguous' }
    if (!matches.length) return { status: discovery.empty || discovery.links.length ? 'not_found' : 'unavailable' }
    profile = matches[0]
  }
  const profileUrl = `${profile}/dynamic`
  await journey.visit(profileUrl)
  const page = await journey.readUntil(readSpacePage, { names: usernameSelectors, activities: activitySelectors },
    value => value.login || value.headings.length > 0 && (value.empty || newestActivity(value.posts) !== undefined))
  const current = new URL(journey.page.url())
  if (current.origin + current.pathname.replace(/\/$/u, '') !== profileUrl) return { status: 'unavailable' }
  if (page.login) return { status: 'login_required' }
  const headings = page.headings.filter(label => label.trim())
  const verifiedName = name ? (headings.some(label => normalizedName(label) === normalizedName(name)) ? name : undefined) : headings[0]
  if (!verifiedName) return { status: 'identity_unverified' }
  if (!page.posts.length) return { status: page.empty ? 'empty' : 'unavailable' }
  const item = newestActivity(page.posts)
  if (!item) return { status: 'time_unverified' }
  return { status: 'found', name: creatorName(verifiedName), profileUrl, text: item.post.text, media: item.post.media, published: item.post.published, publishedAt: item.time }
}
