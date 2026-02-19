import type { MetricId } from '../../metrics'

export type InfluenceMatrix = Record<MetricId, Partial<Record<MetricId, number>>>
export type MetricVector = Record<MetricId, number>
export type WeightsSource = 'manual' | 'learned' | 'mixed'

export interface OracleScenario {
  ts: number
  nameRu: string
  baseTs: number
  impulses: Partial<Record<MetricId, number>>
  result: MetricVector
  index: number
  weightsSource: WeightsSource
  mix: number
}

export interface OracleScenarioDraft {
  baselineTs?: number | 'latest'
  impulses: Partial<Record<MetricId, number>>
  focusMetrics: MetricId[]
  sourceLabelRu?: string
  weightsSource?: WeightsSource
  mix?: number
}

export interface AutoLeverRecommendation {
  from: MetricId
  to: MetricId
  weight: number
  suggestedDelta: number
  expectedIndexDelta: number
}
