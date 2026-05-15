export const HOSTED_OBSERVABILITY_OPTOUT_KEY = 'c4hero:observability:disabled'

function storageOptOut(): boolean {
  try {
    const raw = localStorage.getItem(HOSTED_OBSERVABILITY_OPTOUT_KEY)
    return raw === '1' || raw === 'true' || raw === 'yes'
  } catch {
    return false
  }
}

function navigatorOptOut(): boolean {
  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean
    msDoNotTrack?: string
  }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.msDoNotTrack === '1'
}

export function hasHostedObservabilityOptOut(): boolean {
  return storageOptOut() || navigatorOptOut()
}
