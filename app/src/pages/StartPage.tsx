import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { seedTestData } from '../core/storage/repo'

interface StartPageProps {
  onDone: () => Promise<void>
  hintsEnabled: boolean
  onHintsChange: (next: boolean) => void
}

export function StartPage({ onDone, hintsEnabled, onHintsChange }: StartPageProps) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  return (
    <section className="page start-page" aria-label="О приложении">
      <div className="start-hero">
        <article className="start-copy">
          <p className="start-kicker">About / Help</p>
          <h1>Короткий гид: как использовать мир без обучения</h1>
          <p className="start-promise">Главный экран — «Мир». Нажмите Next Action и выполняйте лучший ход.</p>
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
            Показать подсказки
          </label>
          {hintsEnabled ? (
            <div className="start-hotspots" role="note" aria-label="Подсказки по интерфейсу">
              <p><strong>Где я?</strong> В мире видно режим, риск и доверие.</p>
              <p><strong>Что дальше?</strong> Нажмите Next Action.</p>
            </div>
          ) : null}
        </article>
      </div>

      <section className="start-how panel" aria-label="Быстрый старт">
        <h2>Quick start</h2>
        {[
          ['world', '1. Откройте Мир', 'Это дом приложения: сцена + минимальный HUD + действия.'],
          ['cta', '2. Нажмите Next Action', 'Кнопка всегда активна: либо первый чек-ин, либо лучший ход автопилота.'],
          ['planet', '3. Выберите планету', 'Панель планеты покажет угрозу, рычаг и 3 действия с tail-risk.'],
        ].map(([key, title, body]) => (
          <article key={key} className="start-how-card">
            <h3>{title}</h3>
            <button type="button" className="button-ghost" onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}>Подробнее</button>
            {expanded[key] ? <p>{body}</p> : null}
          </article>
        ))}
      </section>
    </section>
  )
}
