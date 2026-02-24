import { describe, expect, it } from 'vitest'
import type { CheckinRecord } from '../core/models/checkin'
import type { InfluenceEdge } from '../core/engines/influence/influence'
import {
  computeCentralityMetrics,
  computeEarlyWarningSignals,
  computeInfluenceConcentration,
  computeRobustnessScore,
} from './leversMonitor'

const graph: InfluenceEdge[] = [
  { from: 'sleepHours', to: 'energy', weight: 0.8, absWeight: 0.8 },
  { from: 'energy', to: 'focus', weight: 0.6, absWeight: 0.6 },
  { from: 'stress', to: 'sleepHours', weight: -0.5, absWeight: 0.5 },
  { from: 'focus', to: 'productivity', weight: 0.7, absWeight: 0.7 },
  { from: 'energy', to: 'mood', weight: 0.4, absWeight: 0.4 },
]

describe('leversMonitor helpers', () => {
  it('считает центральность по входящим и исходящим весам', () => {
    const result = computeCentralityMetrics(graph)
    expect(result.topOutdegree[0].metric).toBe('energy')
    expect(result.topOutdegree[0].score).toBeCloseTo(1)
    expect(result.topIndegree[0].metric).toBe('energy')
    expect(result.topCentrality[0].metric).toBe('energy')
  })

  it('оценивает концентрацию влияния', () => {
    const result = computeCentralityMetrics(graph)
    const concentration = computeInfluenceConcentration(result.centralityByMetric)
    expect(concentration.top1Share).toBeGreaterThan(0)
    expect(concentration.top3Share).toBeGreaterThanOrEqual(concentration.top1Share)
  })

  it('считает устойчивость при удалении топ-узлов', () => {
    const result = computeCentralityMetrics(graph)
    const rank = result.topCentrality.map((item) => item.metric)
    const robustness = computeRobustnessScore(graph, rank)
    expect(robustness).toBeGreaterThanOrEqual(0)
    expect(robustness).toBeLessThanOrEqual(1)
  })

  it('определяет ранние сигналы на временном ряду', () => {
    const now = Date.now()
    const checkins: CheckinRecord[] = Array.from({ length: 16 }).map((_, index) => {
      const wave = index < 8 ? 0.2 : 1.3
      const stress = index < 8 ? 4 + (index % 2) * 0.3 : 4 + (index % 2) * 2
      return {
        ts: now - (16 - index) * 24 * 60 * 60 * 1000,
        energy: 5 + Math.sin(index) * wave,
        focus: 5,
        mood: 5,
        stress,
        sleepHours: 7 + Math.cos(index) * wave,
        social: 5,
        productivity: 5,
        health: 5,
        cashFlow: 100,
      }
    }).reverse()

    const signals = computeEarlyWarningSignals(checkins, ['sleepHours', 'energy', 'stress'], 14)
    expect(signals.enoughData).toBe(true)
    expect(['Низкий', 'Средний', 'Высокий']).toContain(signals.level)
    expect(signals.bullets.length).toBeLessThanOrEqual(2)
  })
})
