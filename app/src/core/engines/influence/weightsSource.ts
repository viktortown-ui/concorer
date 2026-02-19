import { METRICS } from '../../metrics'
import type { InfluenceMatrix, WeightsSource } from './types'

export function emptyInfluenceMatrix(): InfluenceMatrix {
  return METRICS.reduce<Partial<InfluenceMatrix>>((acc, metric) => {
    acc[metric.id] = {}
    return acc
  }, {}) as InfluenceMatrix
}

export function blendMatrices(manual: InfluenceMatrix, learned: InfluenceMatrix, mix: number): InfluenceMatrix {
  const clampedMix = Math.max(0, Math.min(1, mix))
  const matrix: Partial<InfluenceMatrix> = {}

  for (const metric of METRICS) {
    const from = metric.id
    matrix[from] = {}
    for (const target of METRICS) {
      const to = target.id
      const manualWeight = manual[from]?.[to] ?? 0
      const learnedWeight = learned[from]?.[to] ?? 0
      matrix[from]![to] = Number(((1 - clampedMix) * manualWeight + clampedMix * learnedWeight).toFixed(4))
    }
  }

  return matrix as InfluenceMatrix
}

export function resolveActiveMatrix(
  source: WeightsSource,
  manual: InfluenceMatrix,
  learned: InfluenceMatrix,
  mix: number,
): InfluenceMatrix {
  if (source === 'manual') return manual
  if (source === 'learned') return learned
  return blendMatrices(manual, learned, mix)
}
