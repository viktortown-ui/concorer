import { describe, expect, it } from 'vitest'
import { runTailBacktest } from './tailBacktest'

const day = 24 * 60 * 60 * 1000

describe('tailBacktest', () => {
  it('is deterministic for same stored data', () => {
    const audits = [
      {
        ts: 10 * day,
        horizonSummary: [
          { horizonDays: 3 as const, policyMode: 'risk' as const, actionId: 'a1', stats: { var97_5: 0.1, es97_5: 0.2 } },
        ],
      },
    ]
    const frames = [
      { ts: 10 * day, payload: { stateSnapshot: { index: 100 } } },
      { ts: 13 * day, payload: { stateSnapshot: { index: 80 } } },
    ]

    const a = runTailBacktest({ audits, frames, minSamples: 1 })
    const b = runTailBacktest({ audits, frames, minSamples: 1 })
    expect(a).toEqual(b)
  })

  it('matches audits to future frame at horizon and computes realized loss', () => {
    const result = runTailBacktest({
      audits: [{
        ts: 20 * day,
        horizonSummary: [{ horizonDays: 7, policyMode: 'balanced', actionId: 'b1', stats: { var97_5: 0.09, es97_5: 0.11 } }],
      }],
      frames: [
        { ts: 20 * day, payload: { stateSnapshot: { index: 100 } } },
        { ts: 26 * day, payload: { stateSnapshot: { index: 95 } } },
        { ts: 27 * day, payload: { stateSnapshot: { index: 88 } } },
      ],
      minSamples: 1,
    })

    expect(result.points).toHaveLength(1)
    expect(result.points[0].realizedLoss).toBe(0.12)
    expect(result.points[0].tailEvent).toBe(true)
  })

  it('aggregates exceed rate and loss ratio sanely', () => {
    const result = runTailBacktest({
      audits: [
        { ts: 30 * day, horizonSummary: [{ horizonDays: 3, policyMode: 'growth', actionId: 'g1', stats: { var97_5: 0.1, es97_5: 0.2 } }] },
        { ts: 31 * day, horizonSummary: [{ horizonDays: 3, policyMode: 'growth', actionId: 'g2', stats: { var97_5: 0.1, es97_5: 0.2 } }] },
      ],
      frames: [
        { ts: 30 * day, payload: { stateSnapshot: { index: 100 } } },
        { ts: 33 * day, payload: { stateSnapshot: { index: 85 } } },
        { ts: 31 * day, payload: { stateSnapshot: { index: 100 } } },
        { ts: 34 * day, payload: { stateSnapshot: { index: 98 } } },
      ],
      minSamples: 1,
    })

    expect(result.aggregates).toHaveLength(1)
    expect(result.aggregates[0].tailExceedRate).toBe(0.5)
    expect(result.aggregates[0].tailLossRatio).toBe(0.75)
  })
})
