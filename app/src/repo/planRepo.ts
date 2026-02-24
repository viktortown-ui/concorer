import { db } from '../core/storage/db'
import type { ActivePlan } from '../core/commandBus'

const PLAN_KEY = 'activePlanV1'

function settingsTable() {
  return (db as { settings?: { put: Function; get: Function; delete: Function }; table?: (name: string) => { put: Function; get: Function; delete: Function } }).settings
    ?? (db as { table?: (name: string) => { put: Function; get: Function; delete: Function } }).table?.('settings')
}

export async function saveActivePlan(plan: ActivePlan): Promise<void> {
  const table = settingsTable()
  if (!table) return
  await table.put({ key: PLAN_KEY, value: plan, updatedAt: Date.now() })
}

export async function getActivePlan(): Promise<ActivePlan | null> {
  const table = settingsTable()
  if (!table) return null
  const row = await table.get(PLAN_KEY)
  return (row?.value as ActivePlan | undefined) ?? null
}

export async function clearActivePlan(): Promise<void> {
  const table = settingsTable()
  if (!table) return
  await table.delete(PLAN_KEY)
}
