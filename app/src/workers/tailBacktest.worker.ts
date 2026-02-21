/// <reference lib="webworker" />

import { runTailBacktest } from '../core/engines/analytics/tailBacktest'
import type { ActionAuditRecord } from '../repo/actionAuditRepo'
import type { FrameSnapshotRecord } from '../repo/frameRepo'

self.onmessage = (event: MessageEvent<{ type: 'run'; audits: Pick<ActionAuditRecord, 'ts' | 'horizonSummary'>[]; frames: Pick<FrameSnapshotRecord, 'ts' | 'payload'>[]; minSamples?: number }>) => {
  if (event.data.type !== 'run') return
  try {
    const result = runTailBacktest({ audits: event.data.audits, frames: event.data.frames, minSamples: event.data.minSamples })
    self.postMessage({ type: 'done', result })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Ошибка tail backtest' })
  }
}

export {}
