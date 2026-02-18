import { describe, expect, it } from 'vitest'
import type { CheckinRecord } from '../models/checkin'
import { METRICS } from '../metrics'
import { learnInfluenceBaseline } from './influenceLearn'

function buildCheckinsFromDeltas(sourceDeltas: number[], targetDeltas: number[]): CheckinRecord[] {
  const rows: CheckinRecord[] = []
  let energy = 5
  let focus = 5

  for (let day = 0; day <= sourceDeltas.length; day += 1) {
    if (day > 0) {
      energy += sourceDeltas[day - 1]
      focus += targetDeltas[day - 1]
    }

    rows.push({
      ts: day * 24 * 60 * 60 * 1000,
      energy,
      focus,
      mood: 5,
      stress: 5,
      sleepHours: 7,
      social: 5,
      productivity: 5,
      health: 5,
      cashFlow: 0,
    })
  }

  return rows
}

describe('influenceLearn baseline', () => {
  const metricIds = METRICS.map((metric) => metric.id)

  it('is deterministic for the same input', () => {
    const source = [1, 2, -1, 1, -2, 2, -1, 2, -2, 1, 2, -1, 1, -2, 1, -1, 2, -2]
    const target = [0, 1, 2, -1, 1, -2, 2, -1, 2, -2, 1, 2, -1, 1, -2, 1, -1, 2]
    const checkins = buildCheckinsFromDeltas(source, target)

    const first = learnInfluenceBaseline(checkins, metricIds)
    const second = learnInfluenceBaseline(checkins, metricIds)

    expect(first).toEqual(second)
  })

  it('selects lag with highest absolute correlation', () => {
    const source = [1, -1, 2, -2, 3, -3, 2, -2, 1, -1, 2, -2, 3, -3, 1, -1, 2, -2]
    const target = [0, 0, source[0], source[1], source[2], source[3], source[4], source[5], source[6], source[7], source[8], source[9], source[10], source[11], source[12], source[13], source[14], source[15]]
    const checkins = buildCheckinsFromDeltas(source, target)

    const edges = learnInfluenceBaseline(checkins, metricIds)
    const edge = edges.find((item) => item.from === 'energy' && item.to === 'focus')

    expect(edge).toBeDefined()
    expect(edge?.lag).toBe(2)
    expect(Math.abs(edge?.weight ?? 0)).toBeGreaterThan(0.95)
  })

  it('increases confidence with more effective samples under same signal', () => {
    const pattern = [1, -1, 2, -2, 1, -1, 2, -2]
    const shortSource = [...pattern, ...pattern]
    const shortTarget = [0, ...shortSource.slice(0, -1)]
    const longSource = [...shortSource, ...shortSource]
    const longTarget = [0, ...longSource.slice(0, -1)]

    const shortEdges = learnInfluenceBaseline(buildCheckinsFromDeltas(shortSource, shortTarget), metricIds)
    const longEdges = learnInfluenceBaseline(buildCheckinsFromDeltas(longSource, longTarget), metricIds)

    const short = shortEdges.find((item) => item.from === 'energy' && item.to === 'focus')
    const long = longEdges.find((item) => item.from === 'energy' && item.to === 'focus')

    expect(short).toBeDefined()
    expect(long).toBeDefined()
    expect((long?.confidence ?? 0)).toBeGreaterThan(short?.confidence ?? 0)
  })
})
