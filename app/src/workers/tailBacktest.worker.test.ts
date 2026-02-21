import { describe, expect, it } from 'vitest'
import { runTailBacktest } from '../core/engines/analytics/tailBacktest'

describe('tail backtest worker entry', () => {
  it('runs pure entry used by worker', () => {
    const day = 24 * 60 * 60 * 1000
    const result = runTailBacktest({
      audits: [{ ts: day, horizonSummary: [{ horizonDays: 3, policyMode: 'risk', actionId: 'r1', stats: { var97_5: 0.05, es97_5: 0.1 } }] }],
      frames: [
        { ts: day, payload: { stateSnapshot: { index: 100 } } },
        { ts: day * 4, payload: { stateSnapshot: { index: 90 } } },
      ],
      minSamples: 1,
    })
    expect(result.aggregates[0].tailExceedRate).toBe(1)
  })
})
