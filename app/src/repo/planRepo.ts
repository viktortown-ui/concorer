import { db } from '../core/storage/db'
import type { ActivePlan } from '../core/commandBus'

const PLAN_KEY = 'activePlanV1'

interface PlanSettingsRecord {
  key: string
  value: unknown
  updatedAt: number
}

interface PlanSettingsTable {
  put: (value: PlanSettingsRecord) => Promise<unknown>
  get: (key: string) => Promise<{ value?: unknown } | undefined>
  delete: (key: string) => Promise<unknown>
}

interface DbLikeWithSettings {
  settings?: PlanSettingsTable
  table?: (name: string) => PlanSettingsTable
}

function settingsTable(): PlanSettingsTable | undefined {
  const typedDb = db as unknown as DbLikeWithSettings
  return typedDb.settings ?? typedDb.table?.('settings')
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
