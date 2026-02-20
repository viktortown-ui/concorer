import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import { METRICS, type MetricId } from '../core/metrics'
import { applyImpulse, defaultInfluenceMatrix, type InfluenceEdge } from '../core/engines/influence/influence'
import { getTopEdges } from '../core/engines/influence/graphView'
import { matrixStabilityScore } from '../core/engines/influence/learnedInfluenceEngine'
import { saveOracleScenarioDraft } from '../core/engines/influence/scenarioDraft'
import { emptyInfluenceMatrix, resolveActiveMatrix } from '../core/engines/influence/weightsSource'
import type { InfluenceMatrix, MetricVector, WeightsSource } from '../core/engines/influence/types'
import {
  clearLearnedMatrices,
  getLearnedMatrix,
  loadInfluenceMatrix,
  recomputeLearnedMatrix,
  resetInfluenceMatrix,
  saveInfluenceMatrix,
} from '../core/storage/repo'
import { SparkButton } from '../ui/SparkButton'
import { formatDateTime } from '../ui/format'

type ViewMode = 'levers' | 'map' | 'matrix'
interface GraphNode { id: MetricId; x?: number; y?: number }

function edgeMeaning(edge: InfluenceEdge): string {
  const fromLabel = METRICS.find((metric) => metric.id === edge.from)?.labelRu ?? edge.from
  const toLabel = METRICS.find((metric) => metric.id === edge.to)?.labelRu ?? edge.to
  const action = edge.weight >= 0 ? 'усиливает' : 'ослабляет'
  return `${fromLabel} ${action} ${toLabel} при изменении импульса.`
}

function stabilityLabel(score: number): string {
  const level = matrixStabilityScore(score)
  if (level === 'high') return 'высокий'
  if (level === 'medium') return 'средний'
  return 'низкий'
}

export function GraphPage() {
  const navigate = useNavigate()
  const [manualMatrix, setManualMatrix] = useState<InfluenceMatrix>(defaultInfluenceMatrix)
  const [learnedMatrix, setLearnedMatrix] = useState<InfluenceMatrix>(emptyInfluenceMatrix())
  const [stabilityMatrix, setStabilityMatrix] = useState<InfluenceMatrix>(emptyInfluenceMatrix())
  const [weightsSource, setWeightsSource] = useState<WeightsSource>('manual')
  const [mix, setMix] = useState(0.5)
  const [mode, setMode] = useState<ViewMode>('levers')
  const [trainedOnDays, setTrainedOnDays] = useState<30 | 60 | 'all'>(60)
  const [lags, setLags] = useState<1 | 2 | 3>(2)
  const [learnedMeta, setLearnedMeta] = useState<{ trainedOnDays: number; lags: number; alpha: number; computedAt: number; noteRu: string } | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<{ from: MetricId; to: MetricId } | null>(null)
  const [source, setSource] = useState<MetricId | 'all'>('all')
  const [target, setTarget] = useState<MetricId | 'all'>('all')
  const [sign, setSign] = useState<'all' | 'positive' | 'negative'>('all')
  const [threshold, setThreshold] = useState(0.2)
  const [search, setSearch] = useState('')
  const [topN, setTopN] = useState(15)
  const [impulseMetric, setImpulseMetric] = useState<MetricId>('sleepHours')
  const [delta, setDelta] = useState(1)
  const [steps, setSteps] = useState<1 | 2 | 3>(2)
  const [testResult, setTestResult] = useState<MetricVector | null>(null)

  useEffect(() => {
    void (async () => {
      const [manual, learned] = await Promise.all([loadInfluenceMatrix(), getLearnedMatrix()])
      setManualMatrix(manual)
      if (learned) {
        setLearnedMatrix(learned.weights)
        setStabilityMatrix(learned.stability)
        setLearnedMeta(learned.meta)
      }
    })()
  }, [])

  const metricIds = METRICS.map((m) => m.id)
  const activeMatrix = useMemo(
    () => resolveActiveMatrix(weightsSource, manualMatrix, learnedMatrix, mix),
    [weightsSource, manualMatrix, learnedMatrix, mix],
  )

  const topEdges = useMemo(
    () => getTopEdges(activeMatrix, { source, target, sign, threshold, search, topN }),
    [activeMatrix, source, target, sign, threshold, search, topN],
  )

  const mapEdges = useMemo(
    () => getTopEdges(activeMatrix, { sign: 'all', threshold: 0.15, topN: Number.MAX_SAFE_INTEGER }),
    [activeMatrix],
  )

  const nodes = useMemo(() => {
    const width = 820
    const height = 420
    const simNodes: GraphNode[] = metricIds.map((id) => ({ id }))
    const links = mapEdges.map((edge) => ({ source: edge.from, target: edge.to, weight: edge.weight }))
    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-220))
      .force('center', forceCenter(width / 2, height / 2))
      .force('x', forceX(width / 2).strength(0.03))
      .force('y', forceY(height / 2).strength(0.03))
      .force('link', forceLink(links).id((d) => (d as GraphNode).id).distance(120).strength(0.5))
      .stop()
    for (let i = 0; i < 90; i += 1) simulation.tick()
    return simNodes
  }, [mapEdges, metricIds])

  const selectedWeight = selectedEdge ? activeMatrix[selectedEdge.from]?.[selectedEdge.to] ?? 0 : 0
  const selectedManualWeight = selectedEdge ? manualMatrix[selectedEdge.from]?.[selectedEdge.to] ?? 0 : 0
  const selectedLearnedWeight = selectedEdge ? learnedMatrix[selectedEdge.from]?.[selectedEdge.to] ?? 0 : 0
  const selectedStability = selectedEdge ? stabilityMatrix[selectedEdge.from]?.[selectedEdge.to] ?? 0 : 0

  const runImpulseTest = (metric: MetricId, value: number) => {
    setImpulseMetric(metric)
    setDelta(value)
    const base = metricIds.reduce((acc, id) => ({ ...acc, [id]: 5 }), {} as MetricVector)
    base.cashFlow = 0
    setTestResult(applyImpulse(base, { [metric]: value }, activeMatrix, steps))
  }

  const recompute = async () => {
    const learned = await recomputeLearnedMatrix({ trainedOnDays, lags })
    setLearnedMatrix(learned.weights)
    setStabilityMatrix(learned.stability)
    setLearnedMeta(learned.meta)
  }

  const applyEdgeAsScenario = (from: MetricId, to: MetricId, weight: number) => {
    saveOracleScenarioDraft({
      baselineTs: 'latest',
      impulses: { [from]: weight >= 0 ? 1 : -1 },
      focusMetrics: [from, to],
      sourceLabelRu: `Сценарий из графа: ${METRICS.find((m) => m.id === from)?.labelRu ?? from} → ${METRICS.find((m) => m.id === to)?.labelRu ?? to} (${formatDateTime(Date.now())})`,
      weightsSource,
      mix,
    })
    navigate('/oracle?prefill=1')
  }

  return <section className="page panel graph-page">
    <h1>Граф влияний</h1>
    <div className="settings-actions"><button type="button" onClick={() => { window.localStorage.setItem('gamno.multiverseDraft', JSON.stringify({ impulses: { [impulseMetric]: delta }, focusMetrics: [impulseMetric], sourceLabelRu: 'Контур из Графа', weightsSource, mix })); navigate('/multiverse') }}>Открыть в Мультивселенной</button></div>
    <div className="mode-tabs">
      <button type="button" className={mode === 'levers' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setMode('levers')}>Рычаги</button>
      <button type="button" className={mode === 'map' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setMode('map')}>Карта</button>
      <button type="button" className={mode === 'matrix' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setMode('matrix')}>Матрица</button>
    </div>

    <div className="filters graph-filters">
      <span>Источник весов:</span>
      <button type="button" className={weightsSource === 'manual' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setWeightsSource('manual')}>Manual</button>
      <button type="button" className={weightsSource === 'learned' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setWeightsSource('learned')}>Learned</button>
      <button type="button" className={weightsSource === 'mixed' ? 'filter-button filter-button--active' : 'filter-button'} onClick={() => setWeightsSource('mixed')}>Mixed</button>
      {weightsSource === 'mixed' && <label>Mix {mix.toFixed(2)}<input type="range" min={0} max={1} step={0.05} value={mix} onChange={(e) => setMix(Number(e.target.value))} /></label>}
      {learnedMeta && <span>Обновлено: {formatDateTime(learnedMeta.computedAt)} · окно: {learnedMeta.trainedOnDays} дней · lags: {learnedMeta.lags} · α: {learnedMeta.alpha}</span>}
    </div>

    {!learnedMeta && weightsSource !== 'manual' && (
      <div className="panel empty-state">
        <h2>Learned карта ещё не построена</h2>
        <p>Обучение использует ежедневную историю чек-инов и заполняет пропущенные дни последним известным значением.</p>
        <div className="filters graph-filters">
          <label>Окно
            <select value={trainedOnDays} onChange={(e) => setTrainedOnDays(e.target.value === 'all' ? 'all' : Number(e.target.value) as 30 | 60)}>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value="all">All</option>
            </select>
          </label>
          <label>Lags
            <select value={lags} onChange={(e) => setLags(Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
            </select>
          </label>
          <SparkButton type="button" onClick={() => void recompute()}>Обучить по данным</SparkButton>
        </div>
      </div>
    )}

    <div className="graph-layout"><div>
      {mode === 'levers' && <>
        <div className="filters graph-filters">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по метрике" />
          <select value={source} onChange={(e) => setSource(e.target.value as MetricId | 'all')}><option value="all">Источник: все</option>{METRICS.map((m) => <option key={m.id} value={m.id}>{m.labelRu}</option>)}</select>
          <select value={target} onChange={(e) => setTarget(e.target.value as MetricId | 'all')}><option value="all">Цель: все</option>{METRICS.map((m) => <option key={m.id} value={m.id}>{m.labelRu}</option>)}</select>
          <select value={sign} onChange={(e) => setSign(e.target.value as 'all' | 'positive' | 'negative')}><option value="all">Любой знак</option><option value="positive">Только усиливает</option><option value="negative">Только ослабляет</option></select>
          <label>|w| ≥ <input type="number" step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} /></label>
          <label>Топ N <input type="number" min={1} max={40} value={topN} onChange={(e) => setTopN(Number(e.target.value))} /></label>
          <SparkButton type="button" onClick={() => void recompute()}>Переобучить</SparkButton>
          <button type="button" onClick={() => void clearLearnedMatrices()}>Очистить learned</button>
        </div>
        <table className="table table--dense"><thead><tr><th>От</th><th>К</th><th>Вес</th><th>Уверенность</th><th>Смысл</th><th>Действие</th></tr></thead>
          <tbody>{topEdges.map((edge) => {
            const stability = stabilityMatrix[edge.from]?.[edge.to] ?? 0
            return <tr key={`${edge.from}-${edge.to}`} onClick={() => setSelectedEdge({ from: edge.from, to: edge.to })} className={selectedEdge?.from === edge.from && selectedEdge?.to === edge.to ? 'row-active' : ''}><td>{METRICS.find((m) => m.id === edge.from)?.labelRu}</td><td>{METRICS.find((m) => m.id === edge.to)?.labelRu}</td><td>{edge.weight > 0 ? '+' : ''}{edge.weight.toFixed(2)}</td><td>{stabilityLabel(stability)} ({stability.toFixed(2)})</td><td>{edgeMeaning(edge)}</td><td><button type="button" className="chip" onClick={(event) => { event.stopPropagation(); runImpulseTest(edge.from, edge.weight >= 0 ? 1 : -1) }}>Проверить импульсом</button> <button type="button" className="chip" onClick={(event) => { event.stopPropagation(); applyEdgeAsScenario(edge.from, edge.to, edge.weight) }}>Применить как сценарий</button></td></tr>
          })}</tbody></table>
      </>}

      {mode === 'map' && <svg viewBox="0 0 820 420" className="graph-canvas" role="img" aria-label="Карта влияния">{mapEdges.map((edge) => {
        const from = nodes.find((n) => n.id === edge.from)
        const to = nodes.find((n) => n.id === edge.to)
        if (!from?.x || !from?.y || !to?.x || !to?.y) return null
        return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={edge.weight >= 0 ? '#43f3d0' : '#c084fc'} strokeWidth={Math.max(1, edge.absWeight * 6)} opacity={0.9} onClick={() => setSelectedEdge({ from: edge.from, to: edge.to })} />
      })}{nodes.map((node) => <g key={node.id} transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}><circle r={15} fill="#1c2440" /><text y={4} fill="#fff" textAnchor="middle" fontSize={10}>{METRICS.find((m) => m.id === node.id)?.labelRu ?? node.id}</text></g>)}</svg>}

      {mode === 'matrix' && <table className="table table--dense"><thead><tr><th>От \ К</th>{metricIds.map((id) => <th key={id}>{METRICS.find((m) => m.id === id)?.labelRu}</th>)}</tr></thead>
        <tbody>{metricIds.map((fromId) => <tr key={fromId}><td>{METRICS.find((m) => m.id === fromId)?.labelRu}</td>{metricIds.map((toId) => {
          const weight = activeMatrix[fromId]?.[toId] ?? 0
          return <td key={toId}><button type="button" className="heat-cell" style={{ background: `rgba(${weight > 0 ? '67,243,208' : '192,132,252'}, ${Math.abs(weight)})` }} onClick={() => setSelectedEdge({ from: fromId, to: toId })}>{weight.toFixed(1)}</button></td>
        })}</tr>)}</tbody></table>}
    </div>

    <aside className="inspector panel">
      <h2>Инспектор связи</h2>
      {!selectedEdge ? <p>Выберите связь в списке, на карте или в матрице.</p> : <>
        <p><strong>{METRICS.find((m) => m.id === selectedEdge.from)?.labelRu}</strong> → <strong>{METRICS.find((m) => m.id === selectedEdge.to)?.labelRu}</strong></p>
        <p>manual: {selectedManualWeight >= 0 ? '+' : ''}{selectedManualWeight.toFixed(2)}</p>
        <p>learned: {selectedLearnedWeight >= 0 ? '+' : ''}{selectedLearnedWeight.toFixed(2)}</p>
        <p>mixed: {selectedWeight >= 0 ? '+' : ''}{selectedWeight.toFixed(2)} (mix {mix.toFixed(2)})</p>
        <p>Уверенность: {selectedStability.toFixed(2)} — {stabilityLabel(selectedStability)}</p>
        <input type="range" min={-1} max={1} step={0.05} value={manualMatrix[selectedEdge.from]?.[selectedEdge.to] ?? 0} onChange={(e) => setManualMatrix((prev) => ({ ...prev, [selectedEdge.from]: { ...prev[selectedEdge.from], [selectedEdge.to]: Number(e.target.value) } }))} />
        <button type="button" onClick={() => applyEdgeAsScenario(selectedEdge.from, selectedEdge.to, selectedWeight)}>Применить как сценарий</button>
      </>}
      <div className="settings-actions">
        <SparkButton type="button" onClick={() => void saveInfluenceMatrix(manualMatrix)}>Сохранить manual-карту</SparkButton>
        <SparkButton type="button" onClick={async () => { await resetInfluenceMatrix(); setManualMatrix(await loadInfluenceMatrix()) }}>Сброс manual к умолчанию</SparkButton>
      </div>
    </aside></div>

    <h2>Тест импульса</h2>
    <label>Метрика<select value={impulseMetric} onChange={(e) => setImpulseMetric(e.target.value as MetricId)}>{metricIds.map((id) => <option key={id} value={id}>{METRICS.find((m) => m.id === id)?.labelRu}</option>)}</select></label>
    <label>Δ<input type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} /></label>
    <label>Шаги<select value={steps} onChange={(e) => setSteps(Number(e.target.value) as 1 | 2 | 3)}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
    <SparkButton type="button" onClick={() => runImpulseTest(impulseMetric, delta)}>Запустить</SparkButton>
    {testResult && <p>Результат: {METRICS.map((m) => `${m.labelRu}: ${testResult[m.id].toFixed(1)}`).join(' | ')}</p>}
  </section>
}
