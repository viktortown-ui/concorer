/* @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { getWorldScaleSpec, readWorldScalePreset } from './worldWebglScaleSpec'

describe('worldWebglScaleSpec', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('uses normal preset by default', () => {
    expect(readWorldScalePreset()).toBe('normal')
    expect(getWorldScaleSpec().coreRadiusScale).toBeGreaterThan(1)
  })

  it('reads explicit preset from localStorage in dev mode', () => {
    window.localStorage.setItem('worldScalePreset', 'epic')
    expect(readWorldScalePreset()).toBe('epic')
    expect(getWorldScaleSpec().planetRadiusScale).toBeGreaterThan(1.1)
  })
})
