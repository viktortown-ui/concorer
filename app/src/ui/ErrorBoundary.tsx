import { Component, type ErrorInfo, type ReactNode } from 'react'
import { resetStorageAndReload } from '../core/storage/db'

interface State { hasError: boolean; report: string }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, report: '' }

  static getDerivedStateFromError(): State {
    return { hasError: true, report: '' }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const report = JSON.stringify({ message: error.message, stack: error.stack, info: info.componentStack, ts: Date.now() }, null, 2)
    this.setState({ report })
    window.localStorage.setItem('gamno.lastError', report)
  }

  render() {
    if (this.state.hasError) {
      const report = this.state.report || window.localStorage.getItem('gamno.lastError') || ''
      return <main className="page"><article className="panel"><h1>Произошла ошибка</h1><div className="settings-actions"><button type="button" onClick={() => navigator.clipboard.writeText(report)}>Скопировать отчёт</button><button type="button" onClick={() => { void resetStorageAndReload() }}>Сбросить локальные данные</button><button type="button" onClick={() => window.location.reload()}>Перезагрузить</button><a href="#/system">Открыть Система</a></div></article></main>
    }
    return this.props.children
  }
}
