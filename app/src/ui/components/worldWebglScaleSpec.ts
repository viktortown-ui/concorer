export type WorldScalePreset = 'compact' | 'normal' | 'epic'

export interface WorldScaleSpec {
  coreRadiusScale: number
  planetRadiusScale: number
  orbitRadiusScale: number
  minSeparationScale: number
}

const WORLD_SCALE_PRESETS: Record<WorldScalePreset, WorldScaleSpec> = {
  compact: {
    coreRadiusScale: 1.65,
    planetRadiusScale: 1.45,
    orbitRadiusScale: 0.9,
    minSeparationScale: 1.08,
  },
  normal: {
    coreRadiusScale: 1.9,
    planetRadiusScale: 1.62,
    orbitRadiusScale: 0.94,
    minSeparationScale: 1.2,
  },
  epic: {
    coreRadiusScale: 2.15,
    planetRadiusScale: 1.78,
    orbitRadiusScale: 1.01,
    minSeparationScale: 1.34,
  },
}

export function readWorldScalePreset(): WorldScalePreset {
  const preset = globalThis.localStorage?.getItem('worldScalePreset')
  if (!import.meta.env.DEV) return 'normal'
  if (preset === 'compact' || preset === 'epic') return preset
  return 'normal'
}

export function getWorldScaleSpec(): WorldScaleSpec {
  return WORLD_SCALE_PRESETS[readWorldScalePreset()]
}
