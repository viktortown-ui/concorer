import type { CheckinRecord } from '../core/models/checkin'
import { METRICS, type MetricId } from '../core/metrics'
import type { InfluenceEdge } from '../core/engines/influence/influence'

export interface CentralityEntry {
  metric: MetricId
  score: number
}

export interface CentralityMetrics {
  topOutdegree: CentralityEntry[]
  topIndegree: CentralityEntry[]
  topCentrality: CentralityEntry[]
  outdegreeByMetric: Record<MetricId, number>
  indegreeByMetric: Record<MetricId, number>
  centralityByMetric: Record<MetricId, number>
}

function createZeroMetricMap(): Record<MetricId, number> {
  return Object.fromEntries(METRICS.map((metric) => [metric.id, 0])) as Record<MetricId, number>
}

function topThree(map: Record<MetricId, number>): CentralityEntry[] {
  return Object.entries(map)
    .map(([metric, score]) => ({ metric: metric as MetricId, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

export function computeCentralityMetrics(graph: InfluenceEdge[]): CentralityMetrics {
  const outdegreeByMetric = createZeroMetricMap()
  const indegreeByMetric = createZeroMetricMap()

  graph.forEach((edge) => {
    const weight = Math.abs(edge.weight)
    outdegreeByMetric[edge.from] += weight
    indegreeByMetric[edge.to] += weight
  })

  const centralityByMetric = createZeroMetricMap()
  METRICS.forEach((metric) => {
    centralityByMetric[metric.id] = outdegreeByMetric[metric.id] + indegreeByMetric[metric.id]
  })

  return {
    topOutdegree: topThree(outdegreeByMetric),
    topIndegree: topThree(indegreeByMetric),
    topCentrality: topThree(centralityByMetric),
    outdegreeByMetric,
    indegreeByMetric,
    centralityByMetric,
  }
}

export function computeInfluenceConcentration(centralityByMetric: Record<MetricId, number>) {
  const sorted = Object.values(centralityByMetric).sort((a, b) => b - a)
  const total = sorted.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return { top1Share: 0, top3Share: 0, label: 'распределено' as const }
  }

  const top1Share = sorted[0] / total
  const top3Share = (sorted[0] + (sorted[1] ?? 0) + (sorted[2] ?? 0)) / total

  if (top1Share >= 0.5) return { top1Share, top3Share, label: 'Система держится на 1 узле' as const }
  if (top3Share >= 0.75) return { top1Share, top3Share, label: 'Система держится на 3 узлах' as const }
  return { top1Share, top3Share, label: 'распределено' as const }
}

function largestComponentFraction(nodes: MetricId[], edges: InfluenceEdge[], removed: Set<MetricId>): number {
  const activeNodes = nodes.filter((id) => !removed.has(id))
  if (activeNodes.length === 0) return 0

  const adjacency = new Map<MetricId, Set<MetricId>>()
  activeNodes.forEach((id) => adjacency.set(id, new Set()))

  edges.forEach((edge) => {
    if (removed.has(edge.from) || removed.has(edge.to)) return
    if (Math.abs(edge.weight) <= 0) return
    adjacency.get(edge.from)?.add(edge.to)
    adjacency.get(edge.to)?.add(edge.from)
  })

  let maxSize = 0
  const visited = new Set<MetricId>()

  activeNodes.forEach((node) => {
    if (visited.has(node)) return
    const stack = [node]
    visited.add(node)
    let size = 0

    while (stack.length > 0) {
      const current = stack.pop() as MetricId
      size += 1
      adjacency.get(current)?.forEach((next) => {
        if (!visited.has(next)) {
          visited.add(next)
          stack.push(next)
        }
      })
    }

    maxSize = Math.max(maxSize, size)
  })

  return maxSize / activeNodes.length
}

export function computeRobustnessScore(graph: InfluenceEdge[], centralityRank: MetricId[]): number {
  const nodes = METRICS.map((metric) => metric.id)
  const removals = centralityRank.slice(0, 3)
  if (removals.length === 0) return 1

  let sum = 0
  for (let k = 1; k <= removals.length; k += 1) {
    const removed = new Set(removals.slice(0, k))
    sum += largestComponentFraction(nodes, graph, removed)
  }

  return Number((sum / removals.length).toFixed(3))
}

interface TrendSignal {
  metric: MetricId
  varianceRising: boolean
  inertiaRising: boolean
  recoverySlowing: boolean
}

function variance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const sq = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
  return sq / (values.length - 1)
}

function lag1Autocorrelation(values: number[]): number {
  if (values.length < 3) return 0
  const x = values.slice(1)
  const y = values.slice(0, -1)
  const meanX = x.reduce((sum, value) => sum + value, 0) / x.length
  const meanY = y.reduce((sum, value) => sum + value, 0) / y.length
  let num = 0
  let denX = 0
  let denY = 0
  for (let index = 0; index < x.length; index += 1) {
    const dx = x[index] - meanX
    const dy = y[index] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return 0
  return num / Math.sqrt(denX * denY)
}

function averageRecoveryTime(values: number[]): number {
  if (values.length < 5) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const std = Math.sqrt(variance(values))
  const dropThreshold = median - std * 0.5

  const recoveries: number[] = []
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] >= dropThreshold) continue
    let recovery = 0
    for (let next = index + 1; next < values.length; next += 1) {
      recovery += 1
      if (values[next] >= median) {
        recoveries.push(recovery)
        break
      }
    }
  }

  if (recoveries.length === 0) return 0
  return recoveries.reduce((sum, value) => sum + value, 0) / recoveries.length
}

function metricSeries(checkinsAsc: CheckinRecord[], metric: MetricId): number[] {
  return checkinsAsc
    .map((row) => row[metric])
    .filter((value): value is number => Number.isFinite(value))
}

export function computeEarlyWarningSignals(
  checkinsDesc: CheckinRecord[],
  monitoredMetrics: MetricId[],
  windowSize = 14,
) {
  const checkinsAsc = [...checkinsDesc].reverse()
  const total = checkinsAsc.length
  if (total < windowSize) {
    return {
      enoughData: false,
      current: total,
      required: windowSize,
      level: 'Низкий' as const,
      bullets: [] as string[],
      signals: [] as TrendSignal[],
    }
  }

  const tail = checkinsAsc.slice(-windowSize)
  const signals: TrendSignal[] = monitoredMetrics.map((metric) => {
    const values = metricSeries(tail, metric)
    const half = Math.max(3, Math.floor(values.length / 2))
    const first = values.slice(0, half)
    const second = values.slice(-half)

    const firstVar = variance(first)
    const secondVar = variance(second)
    const firstAc = lag1Autocorrelation(first)
    const secondAc = lag1Autocorrelation(second)
    const firstRecovery = averageRecoveryTime(first)
    const secondRecovery = averageRecoveryTime(second)

    return {
      metric,
      varianceRising: secondVar > firstVar * 1.15,
      inertiaRising: secondAc > firstAc + 0.12 && secondAc > 0.2,
      recoverySlowing: secondRecovery > firstRecovery + 0.4,
    }
  })

  const varianceCount = signals.filter((item) => item.varianceRising).length
  const inertiaCount = signals.filter((item) => item.inertiaRising).length
  const recoveryCount = signals.filter((item) => item.recoverySlowing).length
  const score = varianceCount + inertiaCount + recoveryCount

  const bullets: string[] = []
  if (varianceCount > 0) bullets.push('Растёт разброс показателей.')
  if (inertiaCount > 0) bullets.push('Растёт инерция: системе труднее быстро сменить траекторию.')
  if (recoveryCount > 0) bullets.push('Замедляется восстановление после просадок.')

  const level = score >= 4 ? 'Высокий' : score >= 2 ? 'Средний' : 'Низкий'

  return {
    enoughData: true,
    current: total,
    required: windowSize,
    level,
    bullets: bullets.slice(0, 2),
    signals,
  }
}
