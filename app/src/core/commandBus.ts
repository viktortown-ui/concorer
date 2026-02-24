import type { DecisionContext } from './decisionContext'

export interface ActivePlan {
  id: string
  createdAt: number
  days: number
  selectedBranchId: string
  selectedBranchName: string
  ctx: DecisionContext
  recommendedActions: string[]
}

type CommandMap = {
  runMultiverse: DecisionContext
  acceptPlan: ActivePlan
  clearPlan: undefined
}

type EventMap = {
  multiverseCompleted: { branchCount: number }
  planAccepted: ActivePlan
  planCleared: undefined
}

const bus = new EventTarget()

function emit<T>(type: string, detail: T) {
  bus.dispatchEvent(new CustomEvent(type, { detail }))
}

function on<T>(type: string, handler: (detail: T) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<T>).detail)
  bus.addEventListener(type, listener)
  return () => bus.removeEventListener(type, listener)
}

export function sendCommand<K extends keyof CommandMap>(type: K, payload: CommandMap[K]): void {
  emit(`cmd:${type}`, payload)
}

export function onCommand<K extends keyof CommandMap>(type: K, handler: (payload: CommandMap[K]) => void): () => void {
  return on(`cmd:${type}`, handler)
}

export function sendEvent<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
  emit(`evt:${type}`, payload)
}

export function onEvent<K extends keyof EventMap>(type: K, handler: (payload: EventMap[K]) => void): () => void {
  return on(`evt:${type}`, handler)
}
