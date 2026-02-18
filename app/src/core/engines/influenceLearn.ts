import type { CheckinRecord } from '../models/checkin'
import type { MetricId } from '../metrics'

export type InfluenceLearnMethod = 'baseline-correlation' | 'advanced-ridge'

export interface LearnedInfluenceEdge {
  from: MetricId
  to: MetricId
  weight: number
  lag: 1 | 2 | 3
  confidence: number
  method: InfluenceLearnMethod
}

export interface InfluenceLearnOptions {
  lags?: ReadonlyArray<1 | 2 | 3>
  method?: 'baseline' | 'advanced'
  ridgeAlpha?: number
}

interface CorrelationEstimate {
  corr: number
  nEff: number
}

function clampWeight(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0
  const n = x.length
  const meanX = x.reduce((sum, value) => sum + value, 0) / n
  const meanY = y.reduce((sum, value) => sum + value, 0) / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let index = 0; index < n; index += 1) {
    const dx = x[index] - meanX
    const dy = y[index] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX <= Number.EPSILON || varY <= Number.EPSILON) return 0
  return cov / Math.sqrt(varX * varY)
}

function dailyDeltas(checkinsAsc: CheckinRecord[], metricId: MetricId): number[] {
  const deltas: number[] = []
  for (let index = 1; index < checkinsAsc.length; index += 1) {
    deltas.push(checkinsAsc[index][metricId] - checkinsAsc[index - 1][metricId])
  }
  return deltas
}

function estimateCorrelationWithLag(sourceDeltas: number[], targetDeltas: number[], lag: 1 | 2 | 3): CorrelationEstimate {
  if (sourceDeltas.length !== targetDeltas.length) return { corr: 0, nEff: 0 }
  const alignedSource: number[] = []
  const alignedTarget: number[] = []

  for (let t = lag; t < sourceDeltas.length; t += 1) {
    alignedSource.push(sourceDeltas[t - lag])
    alignedTarget.push(targetDeltas[t])
  }

  return {
    corr: correlation(alignedSource, alignedTarget),
    nEff: alignedSource.length,
  }
}

export function learnInfluenceBaseline(
  checkins: CheckinRecord[],
  metricIds: ReadonlyArray<MetricId>,
  options: Pick<InfluenceLearnOptions, 'lags'> = {},
): LearnedInfluenceEdge[] {
  const lags = options.lags ?? [1, 2, 3]
  const checkinsAsc = [...checkins].sort((a, b) => a.ts - b.ts)
  if (checkinsAsc.length < 3) return []

  const deltasByMetric = metricIds.reduce<Record<MetricId, number[]>>((acc, metricId) => {
    acc[metricId] = dailyDeltas(checkinsAsc, metricId)
    return acc
  }, {} as Record<MetricId, number[]>)

  const edges: LearnedInfluenceEdge[] = []
  for (const from of metricIds) {
    for (const to of metricIds) {
      if (from === to) continue

      let bestLag = lags[0]
      let best = estimateCorrelationWithLag(deltasByMetric[from], deltasByMetric[to], bestLag)

      for (const lag of lags.slice(1)) {
        const candidate = estimateCorrelationWithLag(deltasByMetric[from], deltasByMetric[to], lag)
        if (
          Math.abs(candidate.corr) > Math.abs(best.corr)
          || (Math.abs(candidate.corr) === Math.abs(best.corr) && lag < bestLag)
        ) {
          bestLag = lag
          best = candidate
        }
      }

      const weight = clampWeight(best.corr)
      const confidence = Math.min(1, Math.sqrt(best.nEff) / 10) * Math.abs(weight)
      edges.push({
        from,
        to,
        weight,
        lag: bestLag,
        confidence,
        method: 'baseline-correlation',
      })
    }
  }

  return edges
}

function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, column) => matrix.map((row) => row[column]))
}

function multiply(a: number[][], b: number[][]): number[][] {
  const bt = transpose(b)
  return a.map((row) => bt.map((col) => row.reduce((sum, value, index) => sum + value * col[index], 0)))
}

function invert(matrix: number[][]): number[][] {
  const n = matrix.length
  const identity = Array.from({ length: n }, (_, row) => Array.from({ length: n }, (_, col) => (row === col ? 1 : 0)))
  const augmented = matrix.map((row, index) => [...row, ...identity[index]])

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) maxRow = row
    }
    if (Math.abs(augmented[maxRow][pivot]) <= Number.EPSILON) {
      return identity
    }
    ;[augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]]

    const pivotValue = augmented[pivot][pivot]
    for (let col = 0; col < 2 * n; col += 1) augmented[pivot][col] /= pivotValue

    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let col = 0; col < 2 * n; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col]
      }
    }
  }

  return augmented.map((row) => row.slice(n))
}

/**
 * Optional experimental estimator.
 * Fits per-target ridge regression over lagged source deltas.
 * Baseline correlation mode remains default because it is easier to inspect.
 */
export function learnInfluenceAdvanced(
  checkins: CheckinRecord[],
  metricIds: ReadonlyArray<MetricId>,
  options: Pick<InfluenceLearnOptions, 'lags' | 'ridgeAlpha'> = {},
): LearnedInfluenceEdge[] {
  const lags = options.lags ?? [1, 2, 3]
  const alpha = options.ridgeAlpha ?? 1.2
  const checkinsAsc = [...checkins].sort((a, b) => a.ts - b.ts)
  if (checkinsAsc.length < 6) return []

  const deltasByMetric = metricIds.reduce<Record<MetricId, number[]>>((acc, metricId) => {
    acc[metricId] = dailyDeltas(checkinsAsc, metricId)
    return acc
  }, {} as Record<MetricId, number[]>)

  const maxLag = Math.max(...lags)
  const rows = deltasByMetric[metricIds[0]].length - maxLag
  if (rows < 3) return []

  const edges: LearnedInfluenceEdge[] = []

  for (const to of metricIds) {
    const featureLabels: Array<{ from: MetricId; lag: 1 | 2 | 3 }> = []
    for (const from of metricIds) {
      if (from === to) continue
      for (const lag of lags) {
        featureLabels.push({ from, lag })
      }
    }

    const x: number[][] = []
    const y: number[][] = []

    for (let row = maxLag; row < deltasByMetric[to].length; row += 1) {
      const features = featureLabels.map((label) => deltasByMetric[label.from][row - label.lag])
      x.push(features)
      y.push([deltasByMetric[to][row]])
    }

    const xt = transpose(x)
    const xtx = multiply(xt, x)
    for (let i = 0; i < xtx.length; i += 1) xtx[i][i] += alpha
    const xty = multiply(xt, y)
    const coeff = multiply(invert(xtx), xty).map((entry) => entry[0])

    for (const from of metricIds) {
      if (from === to) continue
      let bestLag: 1 | 2 | 3 = lags[0]
      let bestWeight = 0
      for (const lag of lags) {
        const idx = featureLabels.findIndex((label) => label.from === from && label.lag === lag)
        const value = coeff[idx] ?? 0
        if (Math.abs(value) > Math.abs(bestWeight) || (Math.abs(value) === Math.abs(bestWeight) && lag < bestLag)) {
          bestLag = lag
          bestWeight = value
        }
      }
      const weight = clampWeight(bestWeight)
      const confidence = Math.min(1, Math.sqrt(rows) / 10) * Math.min(1, Math.abs(weight))
      edges.push({ from, to, weight, lag: bestLag, confidence, method: 'advanced-ridge' })
    }
  }

  return edges
}

export function learnInfluence(
  checkins: CheckinRecord[],
  metricIds: ReadonlyArray<MetricId>,
  options: InfluenceLearnOptions = {},
): LearnedInfluenceEdge[] {
  if (options.method === 'advanced') {
    return learnInfluenceAdvanced(checkins, metricIds, options)
  }
  return learnInfluenceBaseline(checkins, metricIds, options)
}
