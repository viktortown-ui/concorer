import { Dexie, type EntityTable } from 'dexie'
import type { CheckinRecord } from '../models/checkin'
import type { SocialEventRecord, PersonRecord, SocialInsightRecord } from '../models/socialRadar'
import type { OracleScenario } from '../engines/influence/types'
import type { QuestRecord } from '../models/quest'
import type { StateSnapshotRecord } from '../models/state'
import type { LearnedMatrixRecord } from './learnedMatrix'
import type { ForecastRunRecord } from '../../repo/forecastRepo'
import type { RegimeSnapshotRecord } from '../models/regime'
import type { GoalEventRecord, GoalRecord } from '../models/goal'
import type { MultiverseRunRecord, MultiverseScenarioRecord, MultiverseSettingsRecord } from '../../repo/multiverseRepo'
import type { BlackSwanRunRecord, BlackSwanScenarioRecord } from '../../repo/blackSwanRepo'
import type { TimeDebtSettingsRecord, TimeDebtSnapshotRecord } from '../models/timeDebt'
import type { PolicyRecord, PolicyRunRecord } from '../../repo/policyRepo'
import type { AntifragilitySettingsRecord, AntifragilitySnapshotRecord, ShockSessionRecord } from '../models/antifragility'
import type { FrameSnapshotRecord } from '../../repo/frameRepo'
import type { ActionAuditRecord } from '../../repo/actionAuditRepo'

export interface AppSettingRecord {
  key: string
  value: unknown
  updatedAt: number
}

export interface OracleScenarioRecord extends OracleScenario {
  id?: number
}

export const schemaVersion = 21

class ConcoreDb extends Dexie {
  checkins!: EntityTable<CheckinRecord, 'id'>
  events!: EntityTable<SocialEventRecord, 'id'>
  people!: EntityTable<PersonRecord, 'id'>
  settings!: EntityTable<AppSettingRecord, 'key'>
  scenarios!: EntityTable<OracleScenarioRecord, 'id'>
  quests!: EntityTable<QuestRecord, 'id'>
  stateSnapshots!: EntityTable<StateSnapshotRecord, 'id'>
  learnedMatrices!: EntityTable<LearnedMatrixRecord, 'key'>
  forecastRuns!: EntityTable<ForecastRunRecord, 'id'>
  regimeSnapshots!: EntityTable<RegimeSnapshotRecord, 'id'>
  goals!: EntityTable<GoalRecord, 'id'>
  goalEvents!: EntityTable<GoalEventRecord, 'id'>
  multiverseScenarios!: EntityTable<MultiverseScenarioRecord, 'id'>
  multiverseRuns!: EntityTable<MultiverseRunRecord, 'id'>
  multiverseSettings!: EntityTable<MultiverseSettingsRecord, 'key'>
  blackSwanScenarios!: EntityTable<BlackSwanScenarioRecord, 'id'>
  blackSwanRuns!: EntityTable<BlackSwanRunRecord, 'id'>
  socialInsights!: EntityTable<SocialInsightRecord, 'id'>
  timeDebtSnapshots!: EntityTable<TimeDebtSnapshotRecord, 'id'>
  timeDebtRules!: EntityTable<TimeDebtSettingsRecord, 'key'>
  policies!: EntityTable<PolicyRecord, 'id'>
  policyRuns!: EntityTable<PolicyRunRecord, 'id'>
  antifragilitySnapshots!: EntityTable<AntifragilitySnapshotRecord, 'id'>
  shockSessions!: EntityTable<ShockSessionRecord, 'id'>
  antifragilityRules!: EntityTable<AntifragilitySettingsRecord, 'key'>
  frameSnapshots!: EntityTable<FrameSnapshotRecord, 'id'>
  actionAudits!: EntityTable<ActionAuditRecord, 'id'>

  constructor() {
    super('gamno-db')
    this.version(1).stores({
      checkins: '++id,ts',
      events: '++id,ts,type',
    })

    this.version(7).stores({
      checkins: '++id,ts',
      events: '++id,ts,type',
      settings: '&key,updatedAt',
      scenarios: '++id,ts,nameRu',
      quests: '++id,createdAt,status',
      stateSnapshots: '++id,ts,level',
      learnedMatrices: '&key,metricSetHash,computedAt,trainedOnDays,lags',
      forecastRuns: '++id,ts,modelType',
      regimeSnapshots: '++id,ts,dayKey,regimeId,sirenLevel',
    })

    this.version(16).stores({
      checkins: '++id,ts',
      events: '++id,ts,dayKey,type,personId',
      people: '++id,nameAlias,updatedAt',
      settings: '&key,updatedAt',
      scenarios: '++id,ts,nameRu',
      quests: '++id,createdAt,status',
      stateSnapshots: '++id,ts,level',
      learnedMatrices: '&key,metricSetHash,computedAt,trainedOnDays,lags',
      forecastRuns: '++id,ts,modelType',
      regimeSnapshots: '++id,ts,dayKey,regimeId,sirenLevel',
      goals: '++id,createdAt,updatedAt,status,groveId,parentGoalId,trashedAt',
      goalEvents: '++id,ts,goalId',
      multiverseScenarios: '++id,updatedAt,nameRu',
      multiverseRuns: '++id,ts',
      multiverseSettings: '&key,updatedAt',
      blackSwanScenarios: '++id,updatedAt,name',
      blackSwanRuns: '++id,ts,baseId',
      socialInsights: '++id,computedAt,windowDays,maxLag',
      timeDebtSnapshots: '++id,ts,dayKey',
      timeDebtRules: '&key,updatedAt',
      policies: '++id,mode,updatedAt,isActive',
      policyRuns: '++id,ts,chosenPolicyId,chosenActionId',
      antifragilitySnapshots: '++id,ts,dayKey,recoveryScore,shockBudget,antifragilityScore',
      shockSessions: '++id,ts,dayKey,type,status',
      antifragilityRules: '&key,updatedAt',
      frameSnapshots: '++id,ts,dayKey',
    })

    this.version(schemaVersion).stores({
      checkins: '++id,ts',
      events: '++id,ts,dayKey,type,personId',
      people: '++id,nameAlias,updatedAt',
      settings: '&key,updatedAt',
      scenarios: '++id,ts,nameRu',
      quests: '++id,createdAt,status',
      stateSnapshots: '++id,ts,level',
      learnedMatrices: '&key,metricSetHash,computedAt,trainedOnDays,lags',
      forecastRuns: '++id,ts,modelType',
      regimeSnapshots: '++id,ts,dayKey,regimeId,sirenLevel',
      goals: '++id,createdAt,updatedAt,status,groveId,parentGoalId,trashedAt',
      goalEvents: '++id,ts,goalId',
      multiverseScenarios: '++id,updatedAt,nameRu',
      multiverseRuns: '++id,ts',
      multiverseSettings: '&key,updatedAt',
      blackSwanScenarios: '++id,updatedAt,name',
      blackSwanRuns: '++id,ts,baseId',
      socialInsights: '++id,computedAt,windowDays,maxLag',
      timeDebtSnapshots: '++id,ts,dayKey',
      timeDebtRules: '&key,updatedAt',
      policies: '++id,mode,updatedAt,isActive',
      policyRuns: '++id,ts,chosenPolicyId,chosenActionId',
      antifragilitySnapshots: '++id,ts,dayKey,recoveryScore,shockBudget,antifragilityScore',
      shockSessions: '++id,ts,dayKey,type,status',
      antifragilityRules: '&key,updatedAt',
      frameSnapshots: '++id,ts,dayKey',
      actionAudits: '++id,ts,chosenActionId,stateHash,seed,[stateHash+seed],[ts+chosenActionId]',
    })
  }
}

export const db = new ConcoreDb()

export interface DbOpenFailure {
  message: string
  report: string
}

let lastDbOpenFailure: DbOpenFailure | null = null

function createFailureReport(error: unknown): string {
  const normalized = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: String(error) }
  return JSON.stringify({
    kind: 'dexie-open-failed',
    schemaVersion,
    ts: Date.now(),
    error: normalized,
  }, null, 2)
}

function showToast(message: string): void {
  if (typeof window === 'undefined' || !window.document?.body) return
  const host = window.document
  const toast = host.createElement('div')
  toast.textContent = message
  toast.setAttribute('role', 'status')
  toast.style.position = 'fixed'
  toast.style.bottom = '16px'
  toast.style.left = '50%'
  toast.style.transform = 'translateX(-50%)'
  toast.style.padding = '10px 14px'
  toast.style.borderRadius = '10px'
  toast.style.background = 'rgba(20, 20, 20, 0.92)'
  toast.style.color = '#fff'
  toast.style.fontSize = '14px'
  toast.style.zIndex = '9999'
  host.body.append(toast)
  window.setTimeout(() => toast.remove(), 2200)
}

db.on('blocked', () => {
  const message = 'База обновляется. Закройте другие вкладки Concorer и обновите страницу.'
  if (typeof window !== 'undefined') window.localStorage.setItem('gamno.dbBlockedMessage', message)
  showToast(message)
})

db.on('versionchange', () => {
  db.close()
  showToast('Обновление… перезагрузка')
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      if (typeof window !== 'undefined') window.location.reload()
    }, 350)
  }
})

export function getLastDbOpenFailure(): DbOpenFailure | null {
  return lastDbOpenFailure
}

export async function openDbWithRecovery(): Promise<void> {
  try {
    await db.open()
    lastDbOpenFailure = null
    if (typeof window !== 'undefined') window.localStorage.removeItem('gamno.dbOpenFailure')
  } catch (error) {
    const report = createFailureReport(error)
    lastDbOpenFailure = {
      message: 'Не удалось открыть локальную базу данных. Попробуйте сброс локальных данных.',
      report,
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gamno.dbOpenFailure', report)
      window.localStorage.setItem('gamno.lastError', report)
    }
    throw error
  }
}

export async function resetStorageAndReload(): Promise<void> {
  await db.delete()
  if (typeof window !== 'undefined') window.location.reload()
}
