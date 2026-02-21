import type { TailBacktestSummary } from '../engines/analytics/tailBacktest'
import type { ActionAuditRecord } from '../../repo/actionAuditRepo'
import type { FrameSnapshotRecord } from '../../repo/frameRepo'

export type TailBacktestWorkerMessage =
  | { type: 'done'; result: TailBacktestSummary }
  | { type: 'error'; message: string }

export function createTailBacktestWorker(onMessage: (msg: TailBacktestWorkerMessage) => void): Worker {
  const worker = new Worker(new URL('../../workers/tailBacktest.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<TailBacktestWorkerMessage>) => onMessage(event.data)
  return worker
}

export function runTailBacktestInWorker(worker: Worker, params: {
  audits: Pick<ActionAuditRecord, 'ts' | 'horizonSummary'>[]
  frames: Pick<FrameSnapshotRecord, 'ts' | 'payload'>[]
  minSamples?: number
}): void {
  worker.postMessage({ type: 'run', ...params })
}
