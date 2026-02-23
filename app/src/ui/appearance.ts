export type ThemeMode = 'dark' | 'light' | 'system'
export type MotionMode = 'normal' | 'reduced' | 'off'
export type TransparencyMode = 'glass' | 'reduced'
export type WorldUiVariant = 'instrument' | 'cinematic'
export type WorldRenderMode = 'svg' | 'webgl'
export type WorldLookPreset = 'clean' | 'cinematic'
export type WorldQuality = 'economy' | 'standard' | 'high'
export type UiPreset = 'clean' | 'neon' | 'instrument' | 'warm'
export type AccentColor = 'auto' | 'cyan' | 'violet' | 'blue'
export type DensityMode = 'normal' | 'compact' | 'comfortable'

export interface AppearanceSettings {
  theme: ThemeMode
  motion: MotionMode
  transparency: TransparencyMode
  worldUiVariant: WorldUiVariant
  worldRenderMode: WorldRenderMode
  worldLookPreset: WorldLookPreset
  worldQuality: WorldQuality
  uiPreset: UiPreset
  accentColor: AccentColor
  density: DensityMode
  fxEnabled: boolean
  uiSoundEnabled: boolean
  uiSoundVolume: number
}

const APPEARANCE_KEY = 'gamno-appearance-v1'

export function loadAppearanceSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return {
    theme: 'system', motion: 'normal', transparency: 'glass', worldUiVariant: 'instrument', worldRenderMode: 'webgl', worldLookPreset: 'clean', worldQuality: 'standard', uiPreset: 'clean', accentColor: 'auto', density: 'normal', fxEnabled: true, uiSoundEnabled: false, uiSoundVolume: 70,
  }

  const systemReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const initial: AppearanceSettings = {
    theme: 'system',
    motion: systemReduced ? 'reduced' : 'normal',
    transparency: 'glass',
    worldUiVariant: 'instrument',
    worldRenderMode: 'webgl',
    worldLookPreset: 'clean',
    worldQuality: 'standard',
    uiPreset: 'clean',
    accentColor: 'auto',
    density: 'normal',
    fxEnabled: true,
    uiSoundEnabled: false,
    uiSoundVolume: 70,
  }

  const raw = window.localStorage.getItem(APPEARANCE_KEY)
  if (!raw) return initial

  try {
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : 'system',
      motion: parsed.motion === 'reduced' || parsed.motion === 'off' ? parsed.motion : 'normal',
      transparency: parsed.transparency === 'reduced' ? 'reduced' : 'glass',
      worldUiVariant: parsed.worldUiVariant === 'cinematic' ? 'cinematic' : 'instrument',
      worldRenderMode: parsed.worldRenderMode === 'svg' ? 'svg' : 'webgl',
      worldLookPreset: parsed.worldLookPreset === 'cinematic' ? 'cinematic' : 'clean',
      worldQuality: parsed.worldQuality === 'economy' || parsed.worldQuality === 'high' ? parsed.worldQuality : 'standard',
      uiPreset: parsed.uiPreset === 'neon' || parsed.uiPreset === 'instrument' || parsed.uiPreset === 'warm' ? parsed.uiPreset : 'clean',
      accentColor: parsed.accentColor === 'cyan' || parsed.accentColor === 'violet' || parsed.accentColor === 'blue' ? parsed.accentColor : 'auto',
      density: parsed.density === 'compact' || parsed.density === 'comfortable' ? parsed.density : 'normal',
      fxEnabled: parsed.fxEnabled !== false,
      uiSoundEnabled: parsed.uiSoundEnabled === true,
      uiSoundVolume: Math.min(100, Math.max(0, Number.isFinite(parsed.uiSoundVolume) ? Number(parsed.uiSoundVolume) : 70)),
    }
  } catch {
    return initial
  }
}

export function saveAppearanceSettings(settings: AppearanceSettings) {
  window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings))
}
