import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HOSTED_OBSERVABILITY_OPTOUT_KEY } from './privacySignals'
import {
  initCloudflareAnalytics,
  normalizeCloudflareAnalyticsToken,
  shouldLoadCloudflareAnalytics,
} from './cloudflareAnalytics'

const TOKEN = ['0b8dce42df1b45e4', '8cb707de70714654'].join('')

describe('Cloudflare analytics initialization', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    document.head.innerHTML = ''
    localStorage.clear()
    history.replaceState(null, '', '/')
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts only Cloudflare-style public site tokens', () => {
    expect(normalizeCloudflareAnalyticsToken(` ${TOKEN} `)).toBe(TOKEN)
    expect(normalizeCloudflareAnalyticsToken('not-a-token')).toBeNull()
    expect(normalizeCloudflareAnalyticsToken(undefined)).toBeNull()
  })

  it('does not load the beacon when no token is configured', () => {
    expect(initCloudflareAnalytics()).toBe(false)
    expect(document.querySelector('script[src*="cloudflareinsights"]')).toBeNull()
  })

  it('injects the Cloudflare Web Analytics beacon when configured', () => {
    vi.stubEnv('VITE_CLOUDFLARE_ANALYTICS_TOKEN', TOKEN)

    expect(initCloudflareAnalytics()).toBe(true)

    const script = document.getElementById('c4hero-cloudflare-analytics') as HTMLScriptElement
    expect(script).toBeTruthy()
    expect(script.src).toBe('https://static.cloudflareinsights.com/beacon.min.js')
    expect(script.defer).toBe(true)
    expect(script.crossOrigin).toBe('anonymous')
    expect(script.referrerPolicy).toBe('strict-origin-when-cross-origin')
    expect(JSON.parse(script.dataset.cfBeacon ?? '{}')).toEqual({ token: TOKEN, spa: false })
  })

  it('does not load on private editor routes', () => {
    vi.stubEnv('VITE_CLOUDFLARE_ANALYTICS_TOKEN', TOKEN)
    history.replaceState(null, '', '/collection/Big%20Bank/ATM/Containers')

    expect(shouldLoadCloudflareAnalytics('/collection/Big%20Bank')).toBe(false)
    expect(initCloudflareAnalytics()).toBe(false)
    expect(document.getElementById('c4hero-cloudflare-analytics')).toBeNull()
  })

  it('can load on non-editor routes without enabling SPA route tracking', () => {
    vi.stubEnv('VITE_CLOUDFLARE_ANALYTICS_TOKEN', TOKEN)
    history.replaceState(null, '', '/')

    expect(shouldLoadCloudflareAnalytics('/')).toBe(true)
    expect(initCloudflareAnalytics()).toBe(true)

    const script = document.getElementById('c4hero-cloudflare-analytics') as HTMLScriptElement
    expect(JSON.parse(script.dataset.cfBeacon ?? '{}')).toEqual({ token: TOKEN, spa: false })
  })

  it('does not inject a duplicate beacon', () => {
    vi.stubEnv('VITE_CLOUDFLARE_ANALYTICS_TOKEN', TOKEN)

    expect(initCloudflareAnalytics()).toBe(true)
    expect(initCloudflareAnalytics()).toBe(true)

    expect(document.querySelectorAll('#c4hero-cloudflare-analytics')).toHaveLength(1)
  })

  it('respects the hosted observability opt-out', () => {
    vi.stubEnv('VITE_CLOUDFLARE_ANALYTICS_TOKEN', TOKEN)
    localStorage.setItem(HOSTED_OBSERVABILITY_OPTOUT_KEY, 'true')

    expect(initCloudflareAnalytics()).toBe(false)
    expect(document.getElementById('c4hero-cloudflare-analytics')).toBeNull()
  })
})
