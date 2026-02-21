import type { HorizonAuditSummaryRecord } from '../../../repo/actionAuditRepo'

export type TailBacktestHorizon = 3 | 7

type TailAuditInput = {
  ts: number
  horizonSummary?: Array<{
    horizonDays: 3 | 7
    policyMode: 'risk' | 'balanced' | 'growth'
    actionId: string
    stats: { var97_5?: number; es97_5?: number }
  }>
}

type TailFrameInput = {
  ts: number
  payload: {
    stateSnapshot?: {
      index?: number
    }
  }
}

export interface TailBacktestAuditPoint {
  auditTs: number
  horizonDays: TailBacktestHorizon
  policyMode: HorizonAuditSummaryRecord['policyMode']
  actionId: string
  predictedVar: number
  predictedEs: number
  realizedLoss: number
  tailEvent: boolean
}

export interface TailBacktestAggregate {
  horizonDays: TailBacktestHorizon
  policyMode: HorizonAuditSummaryRecord['policyMode']
  sampleCount: number
  matchedCount: number
  tailEventCount: number
  tailExceedRate: number
  meanRealizedTailLoss: number
  meanPredictedEs: number
  tailLossRatio: number
  warnings: string[]
}

export interface TailBacktestSummary {
  points: TailBacktestAuditPoint[]
  aggregates: TailBacktestAggregate[]
  warnings: string[]
}

const HORIZON_TO_MS: Record<TailBacktestHorizon, number> = {
  3: 3 * 24 * 60 * 60 * 1000,
  7: 7 * 24 * 60 * 60 * 1000,
}

function toFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function findFrameAtOrBefore(frames: TailFrameInput[], ts: number): TailFrameInput | null {
  let left = 0
  let right = frames.length - 1
  let found = -1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (frames[mid].ts <= ts) {
      found = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return found >= 0 ? frames[found] : null
}

function findFrameAtOrAfter(frames: TailFrameInput[], ts: number): TailFrameInput | null {
  let left = 0
  let right = frames.length - 1
  let found = -1
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (frames[mid].ts >= ts) {
      found = mid
      right = mid - 1
    } else {
      left = mid + 1
    }
  }
  return found >= 0 ? frames[found] : null
}

export function computeRealizedLoss(currentIndex: number, futureIndex: number): number {
  const safeCurrent = Math.max(1e-6, currentIndex)
  return Number(Math.max(0, (safeCurrent - futureIndex) / safeCurrent).toFixed(6))
}

function aggregateByPolicy(points: TailBacktestAuditPoint[], minSamples = 5): TailBacktestAggregate[] {
  const grouped = new Map<string, TailBacktestAuditPoint[]>()
  points.forEach((point) => {
    const key = `${point.horizonDays}:${point.policyMode}`
    const bucket = grouped.get(key)
    if (bucket) bucket.push(point)
    else grouped.set(key, [point])
  })

  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, bucket]) => {
    const tailPoints = bucket.filter((item) => item.tailEvent)
    const sampleCount = bucket.length
    const meanRealizedTailLoss = tailPoints.length ? Number((tailPoints.reduce((sum, item) => sum + item.realizedLoss, 0) / tailPoints.length).toFixed(6)) : 0
    const meanPredictedEs = tailPoints.length ? Number((tailPoints.reduce((sum, item) => sum + item.predictedEs, 0) / tailPoints.length).toFixed(6)) : 0
    const warnings: string[] = []
    if (sampleCount < minSamples) warnings.push(`Недостаточно данных: ${sampleCount} из ${minSamples}.`)
    if (!tailPoints.length) warnings.push('Нет хвостовых превышений VaR(97.5).')

    return {
      horizonDays: bucket[0].horizonDays,
      policyMode: bucket[0].policyMode,
      sampleCount,
      matchedCount: sampleCount,
      tailEventCount: tailPoints.length,
      tailExceedRate: Number((tailPoints.length / sampleCount).toFixed(6)),
      meanRealizedTailLoss,
      meanPredictedEs,
      tailLossRatio: meanPredictedEs > 0 ? Number((meanRealizedTailLoss / meanPredictedEs).toFixed(6)) : 0,
      warnings,
    }
  })
}

export function runTailBacktest(params: {
  audits: TailAuditInput[]
  frames: TailFrameInput[]
  minSamples?: number
}): TailBacktestSummary {
  const sortedFrames = [...params.frames].sort((a, b) => a.ts - b.ts)
  if (!sortedFrames.length) return { points: [], aggregates: [], warnings: ['Нет кадров для backtest.'] }

  const points: TailBacktestAuditPoint[] = []

  for (const audit of params.audits) {
    const startFrame = findFrameAtOrBefore(sortedFrames, audit.ts)
    if (!startFrame) continue

    for (const item of audit.horizonSummary ?? []) {
      if (item.horizonDays !== 3 && item.horizonDays !== 7) continue
      const predictedVar = toFinite(item.stats.var97_5)
      const predictedEs = toFinite(item.stats.es97_5)
      if (predictedVar == null || predictedEs == null || predictedEs <= 0) continue
      const futureFrame = findFrameAtOrAfter(sortedFrames, audit.ts + HORIZON_TO_MS[item.horizonDays])
      if (!futureFrame) continue

      const startIndex = toFinite(startFrame.payload.stateSnapshot?.index)
      const futureIndex = toFinite(futureFrame.payload.stateSnapshot?.index)
      if (startIndex == null || futureIndex == null) continue

      const realizedLoss = computeRealizedLoss(startIndex, futureIndex)
      points.push({
        auditTs: audit.ts,
        horizonDays: item.horizonDays,
        policyMode: item.policyMode,
        actionId: item.actionId,
        predictedVar,
        predictedEs,
        realizedLoss,
        tailEvent: realizedLoss >= predictedVar,
      })
    }
  }

  const aggregates = aggregateByPolicy(points, params.minSamples ?? 5)
  const warnings = points.length ? [] : ['Недостаточно сопоставлений audit↔frame для tail backtest.']
  return { points, aggregates, warnings }
}
