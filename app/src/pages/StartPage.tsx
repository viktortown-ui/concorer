import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listCheckins, seedTestData } from '../core/storage/repo'
import { HeroBackground } from '../ui/components/HeroBackground'
import type { UiPreset } from '../ui/appearance'

interface StartPageProps {
  onDone: () => Promise<void>
  hintsEnabled: boolean
  onHintsChange: (next: boolean) => void
  uiPreset: UiPreset
  worldLookPreset: string
}

type StepStatus = 'done' | 'active' | 'locked'

interface StepVisual {
  icon: string
  collapsedHint: string
}

interface MissionStep {
  id: string
  title: string
  body: string
  details: string
  action: string
  path: string
  status: StepStatus
  visual: StepVisual
}

export function StartPage({ onDone, hintsEnabled, onHintsChange, uiPreset, worldLookPreset }: StartPageProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [checkinsCount, setCheckinsCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    listCheckins().then((rows) => {
      if (!cancelled) setCheckinsCount(rows.length)
    }).catch(() => {
      if (!cancelled) setCheckinsCount(0)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const steps = useMemo<MissionStep[]>(() => {
    const hasCheckins = checkinsCount > 0
    return [
      {
        id: 'world',
        title: 'Открой Мир',
        body: 'Это главный экран: сцена и главные действия.',
        details: 'На экране «Мир» видно текущее состояние, уровень риска и доступные рычаги.',
        action: 'Перейти в Мир',
        path: '/world',
        status: 'active',
        visual: { icon: '🌍', collapsedHint: 'Сцена, риск и рычаги в одном месте' },
      },
      {
        id: 'planet',
        title: 'Выбери планету',
        body: 'Определи, где сейчас самый ценный ход.',
        details: 'Открой карточку планеты и оцени, где сейчас самый полезный следующий шаг.',
        action: 'Открыть Мир',
        path: '/world',
        status: hasCheckins ? 'done' : 'locked',
        visual: { icon: '🪐', collapsedHint: 'Сфокусируйся на ключевом узле' },
      },
      {
        id: 'action',
        title: 'Сделай лучший шаг',
        body: 'Система подскажет оптимальное действие.',
        details: 'Используй подсказку в центре экрана, чтобы не тратить время на сомнения и быстрее наращивать устойчивость.',
        action: 'Сделать шаг',
        path: '/world',
        status: hasCheckins ? 'active' : 'locked',
        visual: { icon: '⚡', collapsedHint: 'Быстрое действие с понятным эффектом' },
      },
      {
        id: 'checkin',
        title: 'Проведи чек-ин',
        body: 'Зафиксируй результат и закрепи динамику.',
        details: 'После первого чек-ина появится история изменений и более точные прогнозы.',
        action: hasCheckins ? 'Обновить чек-ин' : 'Первый чек-ин',
        path: '/core',
        status: hasCheckins ? 'done' : 'active',
        visual: { icon: '🧭', collapsedHint: 'История и обучающий цикл системы' },
      },
    ]
  }, [checkinsCount])

  const activeIndex = steps.findIndex((step) => step.status === 'active')
  const defaultExpandedIndex = activeIndex >= 0 ? activeIndex : 0
  const completedCount = steps.filter((step) => step.status === 'done').length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  const isExpanded = (stepId: string, index: number) => {
    if (expanded[stepId] !== undefined) return expanded[stepId]
    return index === defaultExpandedIndex
  }

  return (
    <section className="page start-page" aria-label="Первый запуск">
      <section className="start-hero">
        <HeroBackground uiPreset={uiPreset} worldLookPreset={worldLookPreset} />
        <article className="start-copy">
          <p className="start-kicker">ПЕРВЫЙ ЗАПУСК</p>
          <h1>Быстрый старт: включи Мир в рабочий ритм</h1>
          <p className="start-promise">Статус, обучение и прямой путь к действию — без лишних шагов.</p>
          <div className="start-cta-row">
            <button type="button" className="start-primary" onClick={() => navigate('/world')}>Открыть Мир</button>
            <button type="button" className="button-secondary" onClick={() => navigate('/core')}>Первый чек-ин</button>
            {import.meta.env.DEV ? (
              <button
                type="button"
                className="button-ghost"
                onClick={async () => {
                  await seedTestData(30, 42)
                  await onDone()
                  navigate('/world')
                }}
              >
                Учебные данные
              </button>
            ) : null}
          </div>
          <label className="start-hints-toggle" htmlFor="start-hints-toggle">
            <input id="start-hints-toggle" type="checkbox" checked={hintsEnabled} onChange={(event) => onHintsChange(event.currentTarget.checked)} />
            Показывать подсказки
          </label>
          {hintsEnabled ? (
            <div className="start-hotspots" role="note" aria-label="Подсказки по интерфейсу">
              <p><strong>Где я?</strong> На экране «Мир» видны режим, риск и доверие.</p>
              <p><strong>Что дальше?</strong> Нажми «Лучший шаг» в центре сцены.</p>
            </div>
          ) : null}
          <section className="start-benefits" aria-label="Что ты получишь">
            <h2>Что ты получишь</h2>
            <div className="start-benefits-grid">
              <article className="start-benefit-card"><h3>Щит</h3><p>Снижай риск до того, как он ударит.</p></article>
              <article className="start-benefit-card"><h3>Прогноз</h3><p>Понимай, какой шаг даст лучший результат.</p></article>
              <article className="start-benefit-card"><h3>История</h3><p>Видь динамику и закрепляй удачные решения.</p></article>
            </div>
          </section>
        </article>
      </section>

      <section className="start-mission panel" aria-label="Миссия быстрого старта">
        <div className="start-mission__head">
          <h2>Миссия: 4 шага до рабочего ритма</h2>
          <p>Прогресс {completedCount}/{steps.length} · {progressPercent}%</p>
        </div>
        <div className="start-mission__meter" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={steps.length}>
          <div className="start-mission__meter-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="start-stepper">
          {steps.map((step, index) => {
            const open = isExpanded(step.id, index)
            return (
              <article key={step.id} className={`start-step start-step--${step.status} ${open ? 'start-step--open' : 'start-step--compact'}`}>
                <div className="start-step__row">
                  <div className="start-step__main">
                    <p className="start-step__index"><span aria-hidden="true">{step.visual.icon}</span> Шаг {index + 1}</p>
                    <h3>{step.title}</h3>
                    <p className="start-step__summary">{step.body}</p>
                    {!open ? <p className="start-step__hint">{step.visual.collapsedHint}</p> : null}
                  </div>
                  <span className="start-step__status">{step.status === 'done' ? 'Готово' : step.status === 'active' ? 'В работе' : 'Закрыто'}</span>
                  <button type="button" className={step.status === 'active' ? 'start-primary' : 'button-secondary'} onClick={() => navigate(step.path)} disabled={step.status === 'locked'}>
                    {step.action}
                  </button>
                </div>
                {open ? (
                  <div className="start-step__details-wrap">
                    <p className="start-step__details">{step.details}</p>
                    <button type="button" className="button-ghost" onClick={() => setExpanded((prev) => ({ ...prev, [step.id]: false }))}>Свернуть</button>
                  </div>
                ) : (
                  <button type="button" className="button-ghost start-step__more" onClick={() => setExpanded((prev) => ({ ...prev, [step.id]: true }))}>Подробнее</button>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
