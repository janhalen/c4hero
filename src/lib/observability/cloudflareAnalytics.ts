import { hasHostedObservabilityOptOut } from './privacySignals'

const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'
const SCRIPT_ID = 'c4hero-cloudflare-analytics'
const CLOUDFLARE_TOKEN_RE = /^[a-f0-9]{32}$/i
const PRIVATE_APP_ROUTE_RE = /^\/collection(?:\/|$)/

export function normalizeCloudflareAnalyticsToken(token: string | undefined): string | null {
  const normalized = token?.trim()
  if (!normalized) return null
  return CLOUDFLARE_TOKEN_RE.test(normalized) ? normalized : null
}

export function shouldLoadCloudflareAnalytics(pathname = window.location.pathname): boolean {
  return !PRIVATE_APP_ROUTE_RE.test(pathname)
}

export function initCloudflareAnalytics(): boolean {
  const token = normalizeCloudflareAnalyticsToken(
    import.meta.env.VITE_CLOUDFLARE_ANALYTICS_TOKEN as string | undefined,
  )
  if (!token || hasHostedObservabilityOptOut() || !shouldLoadCloudflareAnalytics()) return false
  if (document.getElementById(SCRIPT_ID)) return true

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.defer = true
  script.src = CLOUDFLARE_BEACON_SRC
  script.crossOrigin = 'anonymous'
  script.referrerPolicy = 'strict-origin-when-cross-origin'
  script.dataset.cfBeacon = JSON.stringify({ token, spa: false })
  document.head.append(script)
  return true
}
