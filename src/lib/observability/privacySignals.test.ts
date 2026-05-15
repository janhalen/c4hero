import { describe, it, expect, beforeEach } from 'vitest'
import { hasHostedObservabilityOptOut, HOSTED_OBSERVABILITY_OPTOUT_KEY } from './privacySignals'

function setNavigatorFlag(name: 'doNotTrack' | 'globalPrivacyControl', value: unknown): void {
  Object.defineProperty(navigator, name, {
    configurable: true,
    value,
  })
}

describe('hosted observability privacy signals', () => {
  beforeEach(() => {
    localStorage.clear()
    setNavigatorFlag('doNotTrack', undefined)
    setNavigatorFlag('globalPrivacyControl', undefined)
  })

  it('allows hosted observability by default', () => {
    expect(hasHostedObservabilityOptOut()).toBe(false)
  })

  it('respects the local opt-out flag', () => {
    localStorage.setItem(HOSTED_OBSERVABILITY_OPTOUT_KEY, 'true')

    expect(hasHostedObservabilityOptOut()).toBe(true)
  })

  it('respects Global Privacy Control', () => {
    setNavigatorFlag('globalPrivacyControl', true)

    expect(hasHostedObservabilityOptOut()).toBe(true)
  })

  it('respects Do Not Track', () => {
    setNavigatorFlag('doNotTrack', '1')

    expect(hasHostedObservabilityOptOut()).toBe(true)
  })
})
