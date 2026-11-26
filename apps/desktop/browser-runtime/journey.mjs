import { origin } from './policy.mjs'

// Journeys run in a fresh background tab in the chosen browser session.
// Scope is program-owned; observed links cannot add hosts or pass session tokens.
export class BrowserJourney {
  constructor(page, sites, setActiveOrigin) {
    this.page = page
    this.sites = new Set(sites)
    this.setActiveOrigin = setActiveOrigin
    this.visits = 0
  }

  async visit(raw, { allowQuery = false } = {}) {
    const url = new URL(raw)
    const site = origin(url.href)
    if (++this.visits > 5 || !this.sites.has(site) || url.hash || (!allowQuery && url.search)) {
      throw new Error('BROWSER_SITE_PERMISSION')
    }
    this.setActiveOrigin(site)
    try {
      await this.page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 9500 })
    } catch {
      throw new Error('BROWSER_PAGE_OPEN')
    }
    if (new URL(this.page.url()).origin !== site) throw new Error('BROWSER_TAB_CHANGED')
  }

  async waitUntil(predicate, data, timeout = 7000) {
    const state = await this.page.waitForFunction(predicate, data, { timeout }).catch(() => undefined)
    if (!state) return false
    await state.dispose()
    return true
  }

  async read(extractor, args) {
    const current = this.page.url()
    const value = await this.page.evaluate(extractor, args).catch(() => { throw new Error('BROWSER_TAB_CHANGED') })
    if (this.page.url() !== current) throw new Error('BROWSER_TAB_CHANGED')
    return value
  }

  async readUntil(extractor, args, ready, timeout = 8000) {
    const deadline = Date.now() + timeout
    let value = await this.read(extractor, args)
    while (!ready(value) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 250))
      value = await this.read(extractor, args)
    }
    return value
  }
}
