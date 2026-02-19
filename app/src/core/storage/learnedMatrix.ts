import type { MetricId } from '../metrics'
import type { LearnedMatrix } from '../engines/influence/learnedInfluenceEngine'

export interface LearnedMatrixRecord {
  key: string
  metricSetHash: string
  trainedOnDays: number
  lags: number
  computedAt: number
  value: LearnedMatrix
}

export function hashMetricSet(metricIds: MetricId[]): string {
  return metricIds.join('|')
}

export function learnedMatrixKey(metricSetHash: string, trainedOnDays: number, lags: number): string {
  return `${metricSetHash}:${trainedOnDays}:${lags}`
}
