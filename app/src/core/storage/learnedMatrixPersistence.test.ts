import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'

;(globalThis as unknown as { self: typeof globalThis }).self = globalThis

describe('learned matrix persistence', () => {
  beforeEach(async () => {
    const { clearAllData } = await import('./repo')
    await clearAllData()
  })

  it('recompute -> getLearnedMatrix roundtrip', async () => {
    const { addCheckin, recomputeLearnedMatrix, getLearnedMatrix } = await import('./repo')

    for (let i = 0; i < 80; i += 1) {
      await addCheckin({
        energy: 5 + i * 0.01,
        focus: 5 + i * 0.02,
        mood: 5,
        stress: 4,
        sleepHours: 7,
        social: 5,
        productivity: 5 + i * 0.02,
        health: 6,
        cashFlow: 0,
      })
    }

    const computed = await recomputeLearnedMatrix({ trainedOnDays: 60, lags: 2 })
    const loaded = await getLearnedMatrix()

    expect(loaded).not.toBeNull()
    expect(loaded?.meta.lags).toBe(2)
    expect(loaded?.weights).toEqual(computed.weights)
  })
})
