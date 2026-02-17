export interface CheckinValues {
  energy: number
  focus: number
  mood: number
  stress: number
  sleepHours: number
  social: number
  productivity: number
  health: number
  cashFlow: number
}

export interface CheckinRecord extends CheckinValues {
  id?: number
  ts: number
}

export type CheckinMetricKey = keyof CheckinValues

export interface CheckinMetric {
  key: CheckinMetricKey
  label: string
  min: number
  max: number
  step: number
}

export const CHECKIN_METRICS: CheckinMetric[] = [
  { key: 'energy', label: 'Энергия', min: 0, max: 10, step: 1 },
  { key: 'focus', label: 'Фокус', min: 0, max: 10, step: 1 },
  { key: 'mood', label: 'Настроение', min: 0, max: 10, step: 1 },
  { key: 'stress', label: 'Стресс', min: 0, max: 10, step: 1 },
  { key: 'sleepHours', label: 'Сон (часы)', min: 0, max: 12, step: 0.5 },
  { key: 'social', label: 'Социальность', min: 0, max: 10, step: 1 },
  { key: 'productivity', label: 'Продуктивность', min: 0, max: 10, step: 1 },
  { key: 'health', label: 'Самочувствие', min: 0, max: 10, step: 1 },
  { key: 'cashFlow', label: 'Денежный поток', min: 0, max: 1000000, step: 100 },
]

export const DEFAULT_CHECKIN_VALUES: CheckinValues = {
  energy: 5,
  focus: 5,
  mood: 5,
  stress: 5,
  sleepHours: 8,
  social: 5,
  productivity: 5,
  health: 5,
  cashFlow: 0,
}
