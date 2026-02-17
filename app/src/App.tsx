import { useEffect, useMemo, useState, type ChangeEventHandler } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  CHECKIN_METRICS,
  DEFAULT_CHECKIN_VALUES,
  type CheckinMetricKey,
  type CheckinRecord,
  type CheckinValues,
} from './core/models/checkin'
import {
  addCheckin,
  clearAllData,
  exportData,
  getLatestCheckin,
  importData,
  listCheckins
} from './core/storage/repo'

type PageKey = 'core' | 'dashboard' | 'oracle' | 'graph' | 'history' | 'settings'

const pageMeta: { key: PageKey; label: string }[] = [
  { key: 'core', label: 'Чек-ин' },
  { key: 'dashboard', label: 'Дашборд' },
  { key: 'oracle', label: 'Оракул' },
  { key: 'graph', label: 'График' },
  { key: 'history', label: 'История' },
  { key: 'settings', label: 'Настройки' },
]

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('ru-RU')
}

function formatMetricValue(metric: { key: CheckinMetricKey; step: number }, value: number): string {
  if (metric.key === 'cashFlow') {
    return new Intl.NumberFormat('ru-RU').format(value)
  }
  if (metric.step < 1) {
    return value.toFixed(1)
  }
  return String(Math.round(value))
}

function DashboardPage({ checkins }: { checkins: CheckinRecord[] }) {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const last7From = now - 7 * dayMs
  const prev7From = now - 14 * dayMs

  const last7 = checkins.filter((item) => item.ts >= last7From)
  const prev7 = checkins.filter((item) => item.ts >= prev7From && item.ts < last7From)

  const metricRows = CHECKIN_METRICS.map((metric) => {
    const currentAvg =
      last7.length > 0
        ? last7.reduce((sum, item) => sum + item[metric.key], 0) / last7.length
        : 0
    const prevAvg =
      prev7.length > 0
        ? prev7.reduce((sum, item) => sum + item[metric.key], 0) / prev7.length
        : 0

    let trend = '→'
    if (currentAvg > prevAvg) {
      trend = '↑'
    } else if (currentAvg < prevAvg) {
      trend = '↓'
    }

    return {
      metric,
      currentAvg,
      trend,
    }
  })

  return (
    <section className="page">
      <h1>Дашборд</h1>
      <p>Средние значения за последние 7 дней и тренд к предыдущим 7 дням.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Метрика</th>
            <th>Среднее (7 дн.)</th>
            <th>Тренд</th>
          </tr>
        </thead>
        <tbody>
          {metricRows.map((row) => (
            <tr key={row.metric.key}>
              <td>{row.metric.label}</td>
              <td>{formatMetricValue(row.metric, row.currentAvg)}</td>
              <td>{row.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function HistoryPage({ checkins }: { checkins: CheckinRecord[] }) {
  const [days, setDays] = useState<7 | 30 | 90>(7)

  const filtered = useMemo(() => {
    const fromTs = Date.now() - days * 24 * 60 * 60 * 1000
    return checkins.filter((item) => item.ts >= fromTs)
  }, [checkins, days])

  return (
    <section className="page">
      <h1>История</h1>
      <div className="filters">
        {[7, 30, 90].map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-button ${days === value ? 'filter-button--active' : ''}`}
            onClick={() => setDays(value as 7 | 30 | 90)}
          >
            {value} дней
          </button>
        ))}
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Дата</th>
            {CHECKIN_METRICS.map((metric) => (
              <th key={metric.key}>{metric.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={CHECKIN_METRICS.length + 1}>Данных нет.</td>
            </tr>
          ) : (
            filtered.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.ts)}</td>
                {CHECKIN_METRICS.map((metric) => (
                  <td key={metric.key}>{formatMetricValue(metric, item[metric.key])}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  )
}

function CorePage({ onSaved, latest }: { onSaved: () => Promise<void>; latest?: CheckinRecord }) {
  const [values, setValues] = useState<CheckinValues>(DEFAULT_CHECKIN_VALUES)
  const [saving, setSaving] = useState(false)

  const updateValue = (key: CheckinMetricKey, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    await addCheckin(values)
    await onSaved()
    setSaving(false)
  }

  return (
    <section className="page">
      <h1>Чек-ин</h1>
      <div className="form-grid">
        {CHECKIN_METRICS.map((metric) => (
          <label key={metric.key} className="field">
            <span>{metric.label}</span>
            {metric.key === 'cashFlow' ? (
              <input
                type="number"
                min={metric.min}
                max={metric.max}
                step={metric.step}
                value={values[metric.key]}
                onChange={(e) => updateValue(metric.key, Number(e.target.value))}
              />
            ) : (
              <>
                <input
                  type="range"
                  min={metric.min}
                  max={metric.max}
                  step={metric.step}
                  value={values[metric.key]}
                  onChange={(e) => updateValue(metric.key, Number(e.target.value))}
                />
                <input
                  type="number"
                  min={metric.min}
                  max={metric.max}
                  step={metric.step}
                  value={values[metric.key]}
                  onChange={(e) => updateValue(metric.key, Number(e.target.value))}
                />
              </>
            )}
          </label>
        ))}
      </div>

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Сохранение...' : 'Сохранить чек-ин'}
      </button>

      <section className="last-checkin">
        <h2>Последний чек-ин</h2>
        {!latest ? (
          <p>Пока нет сохраненных чек-инов.</p>
        ) : (
          <>
            <p>{formatDate(latest.ts)}</p>
            <ul>
              {CHECKIN_METRICS.map((metric) => (
                <li key={metric.key}>
                  {metric.label}: {formatMetricValue(metric, latest[metric.key])}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </section>
  )
}

function SettingsPage({ onDataChanged }: { onDataChanged: () => Promise<void> }) {
  const handleClear = async () => {
    if (!window.confirm('Удалить все локальные данные?')) {
      return
    }

    await clearAllData()
    await onDataChanged()
  }

  const handleExport = async () => {
    const payload = await exportData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'gamno-export.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleImport: ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const text = await file.text()
    const payload = JSON.parse(text)
    await importData(payload)
    await onDataChanged()
    event.target.value = ''
  }

  return (
    <section className="page">
      <h1>Настройки</h1>
      <div className="settings-actions">
        <button type="button" onClick={handleClear}>
          Очистить данные
        </button>
        <button type="button" onClick={handleExport}>
          Экспорт JSON
        </button>
        <label className="import-label">
          Импорт JSON
          <input type="file" accept="application/json" onChange={handleImport} />
        </label>
      </div>
    </section>
  )
}

function PageStub({ title }: { title: string }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p>Страница-заглушка для раздела {title}.</p>
    </section>
  )
}

function DesktopOnlyGate() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1200)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1200)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (isDesktop) {
    return <DesktopApp />
  }

  return (
    <main className="gate">
      <h1>Только десктоп</h1>
      <p>Откройте приложение на экране шириной не меньше 1200px.</p>
    </main>
  )
}

function DesktopApp() {
  const [checkins, setCheckins] = useState<CheckinRecord[]>([])
  const [latestCheckin, setLatestCheckin] = useState<CheckinRecord | undefined>()

  const loadData = async () => {
    const [all, latest] = await Promise.all([listCheckins(), getLatestCheckin()])
    setCheckins(all)
    setLatestCheckin(latest)
  }

  useEffect(() => {
    void loadData()
  }, [])

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Gamno</h2>
        <nav>
          {pageMeta.map((page) => (
            <NavLink
              key={page.key}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''}`
              }
              to={`/${page.key}`}
            >
              {page.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/core" replace />} />
          <Route path="/core" element={<CorePage onSaved={loadData} latest={latestCheckin} />} />
          <Route path="/dashboard" element={<DashboardPage checkins={checkins} />} />
          <Route path="/history" element={<HistoryPage checkins={checkins} />} />
          <Route path="/settings" element={<SettingsPage onDataChanged={loadData} />} />
          <Route path="/oracle" element={<PageStub title="Оракул" />} />
          <Route path="/graph" element={<PageStub title="График" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <DesktopOnlyGate />
}
