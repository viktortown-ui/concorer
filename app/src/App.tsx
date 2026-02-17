import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

const pages = [
  'Core',
  'Dashboard',
  'Oracle',
  'Graph',
  'History',
  'Settings',
] as const

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
  return (
    <div className="layout">
      <aside className="sidebar">
        <h2>Gamno</h2>
        <nav>
          {pages.map((page) => (
            <NavLink
              key={page}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''}`
              }
              to={`/${page.toLowerCase()}`}
            >
              {page}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/core" replace />} />
          {pages.map((page) => (
            <Route
              key={page}
              path={`/${page.toLowerCase()}`}
              element={<PageStub title={page} />}
            />
          ))}
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <DesktopOnlyGate />
}
