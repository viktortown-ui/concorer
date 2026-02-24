/* @vitest-environment jsdom */
import { act } from 'react'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

describe('SettingsPage product settings', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  it('writes world settings immediately in advanced mode', async () => {
    const { SettingsPage } = await import('./SettingsPage')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <SettingsPage
            onDataChanged={async () => undefined}
            appearance={{ theme: 'system', motion: 'normal', transparency: 'glass', worldUiVariant: 'instrument', worldRenderMode: 'webgl', worldLookPreset: 'clean', worldQuality: 'standard', uiPreset: 'clean', accentColor: 'auto', density: 'normal', fxEnabled: true, uiSoundEnabled: false, uiSoundVolume: 70 }}
            onAppearanceChange={() => undefined}
          />,
        </MemoryRouter>,
      )
    })

    const advancedButton = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes('Продвинутые настройки графики'))
    await act(async () => {
      advancedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const selectiveBloomToggle = [...container.querySelectorAll('label')].find((item) => item.textContent?.includes('Подсветка выбранного'))?.querySelector('input[type="checkbox"]')
    await act(async () => {
      selectiveBloomToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(globalThis.localStorage.getItem('worldSelectiveBloom')).toBe('1')

    await act(async () => { root.unmount() })
    container.remove()
  })

  it('toggles developer mode via 7 clicks on title', async () => {
    const { SettingsPage } = await import('./SettingsPage')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter>
          <SettingsPage
            onDataChanged={async () => undefined}
            appearance={{ theme: 'system', motion: 'normal', transparency: 'glass', worldUiVariant: 'instrument', worldRenderMode: 'webgl', worldLookPreset: 'clean', worldQuality: 'standard', uiPreset: 'clean', accentColor: 'auto', density: 'normal', fxEnabled: true, uiSoundEnabled: false, uiSoundVolume: 70 }}
            onAppearanceChange={() => undefined}
          />,
        </MemoryRouter>,
      )
    })

    const title = container.querySelector('h1')
    for (let i = 0; i < 7; i += 1) {
      await act(async () => {
        title?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
    }

    expect(globalThis.localStorage.getItem('worldDeveloper')).toBe('1')

    await act(async () => { root.unmount() })
    container.remove()
  })
})
