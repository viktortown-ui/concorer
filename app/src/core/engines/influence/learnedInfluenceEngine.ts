import type { MetricConfig, MetricId } from '../../metrics'
import type { CheckinRecord } from '../../models/checkin'
import type { InfluenceMatrix } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const ALPHA_GRID = [0.1, 1, 10] as const
const MIN_ROWS = 12

export interface LearnedInfluenceMeta {
  trainedOnDays: number
  lags: 1 | 2 | 3
  alpha: number
  computedAt: number
  noteRu: string
}

export interface LearnedMatrix {
  weights: InfluenceMatrix
  stability: InfluenceMatrix
  meta: LearnedInfluenceMeta
}

export interface LearnedInfluenceOptions {
  trainedOnDays?: number | 'all'
  lags?: 1 | 2 | 3
  computedAt?: number
}

interface DenseSeries {
  days: number[]
  valuesByMetric: Record<MetricId, number[]>
}

interface RidgeResult {
  weights: InfluenceMatrix
  alpha: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

function emptyMatrix(metricIds: MetricId[]): InfluenceMatrix {
  return metricIds.reduce<Partial<InfluenceMatrix>>((acc, metricId) => {
    acc[metricId] = {}
    return acc
  }, {}) as InfluenceMatrix
}

function transpose(matrix: number[][]): number[][] {
  if (!matrix.length) return []
  return matrix[0].map((_, col) => matrix.map((row) => row[col]))
}

function multiply(a: number[][], b: number[][]): number[][] {
  const bt = transpose(b)
  return a.map((row) => bt.map((col) => row.reduce((sum, value, index) => sum + value * col[index], 0)))
}

function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => (row === col ? 1 : 0)))
}

function invert(matrix: number[][]): number[][] {
  const size = matrix.length
  const augmented = matrix.map((row, idx) => [...row, ...identity(size)[idx]])

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) <= Number.EPSILON) return identity(size)

    ;[augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]]

    const pivotValue = augmented[pivot][pivot]
    for (let col = 0; col < 2 * size; col += 1) augmented[pivot][col] /= pivotValue

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue
      const factor = augmented[row][pivot]
      for (let col = 0; col < 2 * size; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col]
      }
    }
  }

  return augmented.map((row) => row.slice(size))
}

function dayStart(ts: number): number {
  return Math.floor(ts / DAY_MS) * DAY_MS
}

function toDenseSeries(checkins: CheckinRecord[], metricIds: MetricId[]): DenseSeries {
  const sorted = [...checkins].sort((a, b) => a.ts - b.ts)
  if (!sorted.length) return { days: [], valuesByMetric: {} as Record<MetricId, number[]> }

  const minDay = dayStart(sorted[0].ts)
  const maxDay = dayStart(sorted[sorted.length - 1].ts)
  const days: number[] = []
  const valuesByMetric = metricIds.reduce<Record<MetricId, number[]>>((acc, metricId) => {
    acc[metricId] = []
    return acc
  }, {} as Record<MetricId, number[]>)

  let pointer = 0
  let current = sorted[0]

  for (let day = minDay; day <= maxDay; day += DAY_MS) {
    while (pointer < sorted.length && dayStart(sorted[pointer].ts) <= day) {
      current = sorted[pointer]
      pointer += 1
    }

    days.push(day)
    for (const metricId of metricIds) valuesByMetric[metricId].push(current[metricId])
  }

  return { days, valuesByMetric }
}

function zScore(values: number[]): number[] {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std <= Number.EPSILON) return values.map(() => 0)
  return values.map((value) => (value - mean) / std)
}

function chooseAlpha(features: number[][], target: number[]): number {
  const rows = features.length
  const minTrain = Math.max(6, Math.floor(rows * 0.5))
  const valSize = Math.max(2, Math.floor(rows * 0.2))

  let bestAlpha: number = ALPHA_GRID[0]
  let bestMse = Number.POSITIVE_INFINITY

  for (const alpha of ALPHA_GRID) {
    const mses: number[] = []
    for (let trainEnd = minTrain; trainEnd + valSize <= rows; trainEnd += valSize) {
      const xTrain = features.slice(0, trainEnd)
      const yTrain = target.slice(0, trainEnd)
      const xVal = features.slice(trainEnd, trainEnd + valSize)
      const yVal = target.slice(trainEnd, trainEnd + valSize)
      const beta = fitRidgeCoefficients(xTrain, yTrain, alpha)
      const mse = xVal.reduce((sum, row, idx) => {
        const predicted = row.reduce((acc, value, featureIndex) => acc + value * beta[featureIndex], 0)
        const err = predicted - yVal[idx]
        return sum + err * err
      }, 0) / xVal.length
      mses.push(mse)
    }

    const avgMse = mses.length ? mses.reduce((sum, value) => sum + value, 0) / mses.length : Number.POSITIVE_INFINITY
    if (avgMse < bestMse || (avgMse === bestMse && alpha < bestAlpha)) {
      bestMse = avgMse
      bestAlpha = alpha
    }
  }

  return bestAlpha
}

function fitRidgeCoefficients(x: number[][], y: number[], alpha: number): number[] {
  const xt = transpose(x)
  const xtx = multiply(xt, x)
  for (let i = 0; i < xtx.length; i += 1) xtx[i][i] += alpha
  const yColumn = y.map((value) => [value])
  const xty = multiply(xt, yColumn)
  return multiply(invert(xtx), xty).map((row) => row[0])
}

function buildLaggedDataset(
  normalized: Record<MetricId, number[]>,
  metricIds: MetricId[],
  targetId: MetricId,
  lags: 1 | 2 | 3,
): { features: number[][]; labels: number[] } {
  const length = normalized[targetId].length
  const features: number[][] = []
  const labels: number[] = []

  for (let index = lags; index < length; index += 1) {
    const row: number[] = []
    for (const metricId of metricIds) {
      for (let lag = 1; lag <= lags; lag += 1) row.push(normalized[metricId][index - lag])
    }
    features.push(row)
    labels.push(normalized[targetId][index])
  }

  return { features, labels }
}

function trainRidgeMatrix(series: DenseSeries, metricIds: MetricId[], lags: 1 | 2 | 3): RidgeResult {
  const normalized = metricIds.reduce<Record<MetricId, number[]>>((acc, metricId) => {
    acc[metricId] = zScore(series.valuesByMetric[metricId])
    return acc
  }, {} as Record<MetricId, number[]>)

  const raw = emptyMatrix(metricIds)
  const alphas: number[] = []

  for (const targetId of metricIds) {
    const { features, labels } = buildLaggedDataset(normalized, metricIds, targetId, lags)
    if (features.length < MIN_ROWS) continue

    const alpha = chooseAlpha(features, labels)
    alphas.push(alpha)
    const beta = fitRidgeCoefficients(features, labels, alpha)

    for (let metricIndex = 0; metricIndex < metricIds.length; metricIndex += 1) {
      const fromId = metricIds[metricIndex]
      let sum = 0
      for (let lag = 0; lag < lags; lag += 1) {
        const coeff = beta[metricIndex * lags + lag] ?? 0
        sum += coeff
      }
      raw[fromId][targetId] = sum
    }
  }

  let maxAbs = 0
  for (const fromId of metricIds) {
    for (const toId of metricIds) {
      const abs = Math.abs(raw[fromId][toId] ?? 0)
      if (abs > maxAbs) maxAbs = abs
    }
  }

  const scale = maxAbs > Number.EPSILON ? maxAbs : 1
  const weights = emptyMatrix(metricIds)

  for (const fromId of metricIds) {
    for (const toId of metricIds) {
      const scaled = (raw[fromId][toId] ?? 0) / scale
      weights[fromId][toId] = round4(clamp(scaled, -1, 1))
    }
  }

  const alpha = alphas.length ? Number((alphas.reduce((sum, value) => sum + value, 0) / alphas.length).toFixed(2)) : ALPHA_GRID[1]
  return { weights, alpha }
}

function sliceSeries(series: DenseSeries, days: number): DenseSeries {
  if (days >= series.days.length) return series
  const from = series.days.length - days
  const metricIds = Object.keys(series.valuesByMetric) as MetricId[]
  return {
    days: series.days.slice(from),
    valuesByMetric: metricIds.reduce<Record<MetricId, number[]>>((acc, metricId) => {
      acc[metricId] = series.valuesByMetric[metricId].slice(from)
      return acc
    }, {} as Record<MetricId, number[]>),
  }
}

function stabilityScore(a: number, b: number): number {
  if (Math.abs(a) < 0.05 && Math.abs(b) < 0.05) return 1
  const signAgree = Math.sign(a) === Math.sign(b) ? 1 : 0
  const magAgree = 1 - clamp(Math.abs(Math.abs(a) - Math.abs(b)), 0, 1)
  return round4(clamp(signAgree * 0.6 + magAgree * 0.4, 0, 1))
}

function computeStability(series: DenseSeries, metricIds: MetricId[], lags: 1 | 2 | 3): InfluenceMatrix {
  const shortWindow = sliceSeries(series, 30)
  const longWindow = sliceSeries(series, 60)

  const short = trainRidgeMatrix(shortWindow, metricIds, lags).weights
  const long = trainRidgeMatrix(longWindow, metricIds, lags).weights
  const stability = emptyMatrix(metricIds)

  for (const fromId of metricIds) {
    for (const toId of metricIds) {
      stability[fromId][toId] = stabilityScore(short[fromId][toId] ?? 0, long[fromId][toId] ?? 0)
    }
  }

  return stability
}

export function trainLearnedInfluenceMatrix(
  checkins: CheckinRecord[],
  metrics: MetricConfig[],
  options: LearnedInfluenceOptions = {},
): LearnedMatrix {
  const metricIds = metrics.map((metric) => metric.id)
  const dense = toDenseSeries(checkins, metricIds)
  const trainedOnDays = options.trainedOnDays === 'all' || options.trainedOnDays === undefined
    ? dense.days.length
    : clamp(options.trainedOnDays, 1, dense.days.length)
  const lags = options.lags ?? 2
  const selected = sliceSeries(dense, trainedOnDays)

  if (selected.days.length <= lags + MIN_ROWS) {
    return {
      weights: emptyMatrix(metricIds),
      stability: emptyMatrix(metricIds),
      meta: {
        trainedOnDays: selected.days.length,
        lags,
        alpha: ALPHA_GRID[1],
        computedAt: options.computedAt ?? Date.now(),
        noteRu: 'Дни без чек-ина заполняются последним известным значением (forward-fill).',
      },
    }
  }

  const trained = trainRidgeMatrix(selected, metricIds, lags)
  return {
    weights: trained.weights,
    stability: computeStability(selected, metricIds, lags),
    meta: {
      trainedOnDays: selected.days.length,
      lags,
      alpha: trained.alpha,
      computedAt: options.computedAt ?? Date.now(),
      noteRu: 'Дни без чек-ина заполняются последним известным значением (forward-fill).',
    },
  }
}

export function matrixStabilityScore(value: number): 'high' | 'medium' | 'low' {
  if (value >= 0.75) return 'high'
  if (value >= 0.45) return 'medium'
  return 'low'
}
