import { assessCollapseRisk } from '../../collapse/model'
import { METRICS, type MetricId } from '../../metrics'
import type { RegimeId } from '../../models/regime'
import { clampMetric } from '../influence/influence'
import type { InfluenceMatrix } from '../influence/types'
import { computeIndexDay } from '../analytics/compute'
import { applyBoundedPropagation, goalScoreOf, rankHedges, summarizeTail } from './scoring'
import type { ActionLever, MultiverseBranchId, MultiverseConfig, MultiverseRunResult, PathPoint, RunMultiverseDeps } from './types'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6D2B79F5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  if (sorted[base + 1] === undefined) return sorted[base] ?? 0
  return sorted[base] + rest * (sorted[base + 1] - sorted[base])
}

function sampleTransition(rand: () => number, from: RegimeId, matrix: number[][]): RegimeId {
  const row = matrix[from] ?? []
  const r = rand()
  let cumulative = 0
  for (let i = 0; i < row.length; i += 1) {
    cumulative += row[i] ?? 0
    if (r <= cumulative) return i as RegimeId
  }
  return from
}

function perturbMatrix(base: InfluenceMatrix, stability: InfluenceMatrix | undefined, rand: () => number): InfluenceMatrix {
  const sampled: Partial<InfluenceMatrix> = {}
  for (const fromMetric of METRICS) {
    sampled[fromMetric.id] = {}
    for (const toMetric of METRICS) {
      const from = fromMetric.id
      const to = toMetric.id
      const baseWeight = base[from]?.[to] ?? 0
      const st = stability?.[from]?.[to] ?? 0.5
      const sigma = Math.max(0.01, (1 - st) * 0.2)
      const noise = (rand() - 0.5) * 2 * sigma
      sampled[from]![to] = Math.max(-1, Math.min(1, Number((baseWeight + noise).toFixed(4))))
    }
  }
  return sampled as InfluenceMatrix
}

function impulsesByDay(config: MultiverseConfig): Map<number, Partial<Record<MetricId, number>>> {
  const map = new Map<number, Partial<Record<MetricId, number>>>()
  for (const impulse of config.plan.impulses) {
    const row = map.get(impulse.day) ?? {}
    row[impulse.metricId] = (row[impulse.metricId] ?? 0) + impulse.delta
    map.set(impulse.day, row)
  }
  return map
}

function shockScale(mode: MultiverseConfig['shockMode'], rand: () => number): number {
  if (mode === 'off') return 0
  if (mode === 'normal') return 1
  return rand() > 0.92 ? 3.2 : 1.2
}



function classifyBranch(point: PathPoint): MultiverseBranchId {
  if (point.index >= 7 && point.pCollapse < 0.2) return 'gold'
  if (point.index <= 5 || point.pCollapse >= 0.35) return 'abyss'
  return 'grey'
}

function branchNameRu(id: MultiverseBranchId): string {
  if (id === 'gold') return 'Золотая ветка'
  if (id === 'abyss') return 'Бездна'
  return 'Серая ветка'
}

function topDrivers(config: MultiverseConfig, id: MultiverseBranchId): string[] {
  const fromPlan = config.plan.impulses.slice(0, 2).map((impulse) => {
    const label = METRICS.find((metric) => metric.id === impulse.metricId)?.labelRu ?? impulse.metricId
    return `Рычаг «${label}» (${impulse.delta > 0 ? '+' : ''}${impulse.delta.toFixed(1)})`
  })
  const runtime = [
    config.shockMode === 'off' ? 'Шоки выключены' : config.shockMode === 'blackSwan' ? 'Усиленный шок-профиль' : 'Нормальный шок-профиль',
    `Источник весов: ${config.weightsSource}`,
  ]
  const branchHint = id === 'gold' ? 'Низкая вероятность коллапса' : id === 'abyss' ? 'Доминирует риск коллапса' : 'Баланс роста и риска'
  return [branchHint, ...fromPlan, ...runtime].slice(0, 3)
}

function buildActionLevers(config: MultiverseConfig): ActionLever[] {
  return rankHedges(config.baseVector, config.matrix, config.indexFloor, config.collapseConstraintPct).map((hedge) => {
    const metric = METRICS.find((item) => item.id === hedge.metricId)
    return {
      metricId: hedge.metricId,
      titleRu: `Подвинуть «${metric?.labelRu ?? hedge.metricId}»`,
      delta: hedge.delta,
      reasonRu: hedge.noteRu,
    }
  })
}

function normalizeRegimeMap(paths: PathPoint[][], day: number): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const path of paths) {
    const regime = path[day]?.regimeId ?? path.at(-1)?.regimeId ?? 0
    counts[regime] = (counts[regime] ?? 0) + 1
  }
  for (const key of Object.keys(counts)) {
    counts[Number(key)] = Number((counts[Number(key)] / Math.max(paths.length, 1)).toFixed(4))
  }
  return counts
}

export function runMultiverse(config: MultiverseConfig, deps: RunMultiverseDeps = {}): MultiverseRunResult {
  const rand = mulberry32(config.seed)
  const dailyImpulses = impulsesByDay(config)
  const paths: PathPoint[][] = []

  for (let run = 0; run < config.runs; run += 1) {
    if (deps.shouldCancel?.()) break
    if (run % 200 === 0) deps.onProgress?.(run, config.runs)

    let vector = { ...config.baseVector }
    let regime = config.baseRegime
    const matrix = config.toggles.weightsNoise ? perturbMatrix(config.matrix, config.learnedStability, rand) : config.matrix
    const path: PathPoint[] = []

    for (let day = 1; day <= config.horizonDays; day += 1) {
      const noiseScale = shockScale(config.shockMode, rand)
      const forecastNoise = config.toggles.forecastNoise && config.forecastResiduals?.length
        ? (config.forecastResiduals[Math.floor(rand() * config.forecastResiduals.length)] ?? 0) * noiseScale
        : 0
      const impulses = { ...(dailyImpulses.get(day) ?? {}), ...(day === 1 ? dailyImpulses.get(0) ?? {} : {}) }
      vector = applyBoundedPropagation(vector, impulses, matrix)
      vector.energy = clampMetric('energy', vector.energy + forecastNoise * 0.06)
      vector.mood = clampMetric('mood', vector.mood + forecastNoise * 0.04)
      vector.stress = clampMetric('stress', vector.stress - forecastNoise * 0.05)

      if (config.toggles.stochasticRegime) {
        regime = sampleTransition(rand, regime, config.transitionMatrix)
      }

      const index = computeIndexDay({ ...vector, ts: 0 })
      const collapse = assessCollapseRisk({
        ts: 0,
        index,
        risk: Math.max(0, 10 - index),
        volatility: Math.abs(forecastNoise),
        xp: 0,
        level: 0,
        entropy: 0,
        drift: 0,
        stats: { strength: vector.health * 10, intelligence: vector.focus * 10, wisdom: vector.mood * 10, dexterity: vector.energy * 10 },
      }, { ...vector, ts: 0 })

      const pCollapse = Math.max(0, Math.min(1, collapse.pCollapse + (regime === 4 ? 0.06 : regime === 3 ? 0.03 : regime === 1 ? -0.02 : 0)))
      const siren = pCollapse > 0.35 ? 'red' : pCollapse >= 0.2 ? 'amber' : 'green'
      path.push({ day, index: Number(index.toFixed(4)), pCollapse: Number(pCollapse.toFixed(4)), siren, goalScore: goalScoreOf(vector, config.activeGoalWeights), regimeId: regime })
    }

    paths.push(path)
  }

  deps.onProgress?.(paths.length, config.runs)

  const days = Array.from({ length: config.horizonDays }, (_, index) => index + 1)
  const quantiles = {
    days,
    index: { p10: [] as number[], p50: [] as number[], p90: [] as number[] },
    pCollapse: { p10: [] as number[], p50: [] as number[], p90: [] as number[] },
    goalScore: config.activeGoalWeights ? { p10: [] as number[], p50: [] as number[], p90: [] as number[] } : undefined,
  }

  for (let step = 0; step < config.horizonDays; step += 1) {
    const indexBucket = paths.map((path) => path[step]?.index ?? config.baseIndex)
    const collapseBucket = paths.map((path) => path[step]?.pCollapse ?? config.basePCollapse)
    quantiles.index.p10.push(Number(quantile(indexBucket, 0.1).toFixed(4)))
    quantiles.index.p50.push(Number(quantile(indexBucket, 0.5).toFixed(4)))
    quantiles.index.p90.push(Number(quantile(indexBucket, 0.9).toFixed(4)))
    quantiles.pCollapse.p10.push(Number(quantile(collapseBucket, 0.1).toFixed(4)))
    quantiles.pCollapse.p50.push(Number(quantile(collapseBucket, 0.5).toFixed(4)))
    quantiles.pCollapse.p90.push(Number(quantile(collapseBucket, 0.9).toFixed(4)))

    if (quantiles.goalScore) {
      const goalBucket = paths.map((path) => path[step]?.goalScore ?? 0)
      quantiles.goalScore.p10.push(Number(quantile(goalBucket, 0.1).toFixed(4)))
      quantiles.goalScore.p50.push(Number(quantile(goalBucket, 0.5).toFixed(4)))
      quantiles.goalScore.p90.push(Number(quantile(goalBucket, 0.9).toFixed(4)))
    }
  }

  const baseGoalScore = goalScoreOf(config.baseVector, config.activeGoalWeights)
  const tail = summarizeTail(paths, config.indexFloor, config.baseIndex, config.basePCollapse, baseGoalScore)
  const sortedByWorst = [...paths].sort((a, b) => (a.at(-1)?.index ?? 0) - (b.at(-1)?.index ?? 0))
  const representativeWorstPath = sortedByWorst[Math.floor(sortedByWorst.length * 0.05)] ?? sortedByWorst[0] ?? []
  const medianIndex = quantile(paths.map((path) => path.at(-1)?.index ?? config.baseIndex), 0.5)
  const byBranch: Record<MultiverseBranchId, PathPoint[][]> = { gold: [], grey: [], abyss: [] }
  for (const path of paths) {
    const branchId = classifyBranch(path.at(-1) ?? { day: config.horizonDays, index: config.baseIndex, pCollapse: config.basePCollapse, regimeId: config.baseRegime, siren: 'green' })
    byBranch[branchId].push(path)
  }

  const baseGoal = goalScoreOf(config.baseVector, config.activeGoalWeights) ?? 0
  const branches = (['gold', 'grey', 'abyss'] as MultiverseBranchId[]).map((id) => {
    const group = byBranch[id]
    const probability = group.length / Math.max(paths.length, 1)
    const expectedIndex = days.map((_, day) => Number((group.reduce((acc, path) => acc + (path[day]?.index ?? config.baseIndex), 0) / Math.max(group.length, 1)).toFixed(4)))
    const expectedPCollapse = days.map((_, day) => Number((group.reduce((acc, path) => acc + (path[day]?.pCollapse ?? config.basePCollapse), 0) / Math.max(group.length, 1)).toFixed(4)))
    const goalScoreEnd = Number((group.reduce((acc, path) => acc + (path.at(-1)?.goalScore ?? baseGoal), 0) / Math.max(group.length, 1)).toFixed(4))
    return {
      id,
      nameRu: branchNameRu(id),
      probability: Number(probability.toFixed(4)),
      expectedIndex,
      expectedPCollapse,
      goalScoreEnd,
      goalScoreDelta: Number((goalScoreEnd - baseGoal).toFixed(4)),
      tailRiskChip: `RED ${(group.filter((path) => path.some((point) => point.siren === 'red')).length / Math.max(group.length, 1) * 100).toFixed(1)}%`,
      topDrivers: topDrivers(config, id),
    }
  })

  return {
    generatedAt: Date.now(),
    config,
    quantiles,
    distributions: {
      horizonIndex: paths.map((path) => Number((path.at(-1)?.index ?? config.baseIndex).toFixed(4))),
      horizonGoalScore: config.activeGoalWeights ? paths.map((path) => Number((path.at(-1)?.goalScore ?? 0).toFixed(4))) : undefined,
    },
    tail,
    representativeWorstPath,
    hedges: rankHedges(config.baseVector, config.matrix, config.indexFloor, config.collapseConstraintPct),
    actionLevers: buildActionLevers(config),
    audit: {
      weightsSource: config.weightsSource,
      mix: config.mix,
      forecastModelType: config.audit.forecastModelType,
      lags: config.audit.lags,
      trainedOnDays: config.audit.trainedOnDays,
    },
    samplePaths: [paths[0] ?? [], paths[Math.floor(paths.length / 2)] ?? [], representativeWorstPath],
    trajectoryExplorer: {
      probable: [...paths].sort((a, b) => Math.abs((a.at(-1)?.index ?? 0) - medianIndex) - Math.abs((b.at(-1)?.index ?? 0) - medianIndex)).slice(0, 5),
      best: [...paths].sort((a, b) => (b.at(-1)?.index ?? 0) - (a.at(-1)?.index ?? 0)).slice(0, 5),
      worst: [...paths].sort((a, b) => ((b.at(-1)?.pCollapse ?? 0) - (a.at(-1)?.pCollapse ?? 0)) || ((a.at(-1)?.index ?? 0) - (b.at(-1)?.index ?? 0))).slice(0, 5),
    },
    regimeMap: {
      horizon: normalizeRegimeMap(paths, config.horizonDays - 1),
      next1: normalizeRegimeMap(paths, 0),
      next3: normalizeRegimeMap(paths, Math.min(2, config.horizonDays - 1)),
    },
    branches,
  }
}

