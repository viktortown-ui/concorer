import { describe, expect, it } from 'vitest'
import { METRICS } from '../../metrics'
import type { CheckinRecord } from '../../models/checkin'
import { matrixStabilityScore, trainLearnedInfluenceMatrix } from './learnedInfluenceEngine'

function syntheticCheckins(days = 90): CheckinRecord[] {
  const rows: CheckinRecord[] = []
  for (let i = 0; i < days; i += 1) {
    const prev = rows[i - 1]
    const energy = 5 + Math.sin(i / 5)
    const focus = prev ? prev.focus * 0.5 + energy * 0.4 : 5
    rows.push({
      ts: Date.UTC(2025, 0, i + 1),
      energy,
      focus,
      mood: 5,
      stress: 5 - energy * 0.3,
      sleepHours: 7,
      social: 5,
      productivity: focus,
      health: 6,
      cashFlow: 0,
    })
  }
  return rows
}

describe('learnedInfluenceEngine', () => {
  it('детерминирован при одинаковом входе', () => {
    const checkins = syntheticCheckins(90)
    const first = trainLearnedInfluenceMatrix(checkins, METRICS, { trainedOnDays: 60, lags: 2, computedAt: 1000 })
    const second = trainLearnedInfluenceMatrix(checkins, METRICS, { trainedOnDays: 60, lags: 2, computedAt: 1000 })
    expect(first).toEqual(second)
  })

  it('ridge даёт разумный знак на синтетике', () => {
    const checkins = syntheticCheckins(100)
    const result = trainLearnedInfluenceMatrix(checkins, METRICS, { trainedOnDays: 60, lags: 1, computedAt: 1000 })
    expect((result.weights.energy?.focus ?? 0) > 0).toBe(true)
  })

  it('стабильность классифицируется по порогам', () => {
    expect(matrixStabilityScore(0.9)).toBe('high')
    expect(matrixStabilityScore(0.6)).toBe('medium')
    expect(matrixStabilityScore(0.2)).toBe('low')
  })
})
