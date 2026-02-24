import type { WeightsSource } from './engines/influence/types'

export type DecisionSourceTool = 'levers' | 'multiverse' | 'world' | 'oracle'

export interface DecisionContext {
  sourceTool: DecisionSourceTool
  leverKey: string
  delta: number
  horizonDays?: number
  waves?: 1 | 2 | 3
  weightsMode: 'ручной' | 'из данных' | 'смешанный'
  mixValue?: number
  shockProfile?: 'off' | 'normal' | 'blackSwan'
  noiseLevel?: 'on' | 'off'
  whyEdges?: string[]
  riskNote?: string
  confidenceLabel?: string
}

type EncodedContext = {
  s: DecisionSourceTool
  l: string
  d: number
  h?: number
  w?: 1 | 2 | 3
  wm: DecisionContext['weightsMode']
  m?: number
  sp?: DecisionContext['shockProfile']
  n?: DecisionContext['noiseLevel']
  y?: string[]
  r?: string
  c?: string
}

const QUERY_KEY = 'ctx'

export function sourceToWeightsMode(source: WeightsSource): DecisionContext['weightsMode'] {
  if (source === 'learned') return 'из данных'
  if (source === 'mixed') return 'смешанный'
  return 'ручной'
}

export function weightsModeToSource(mode: DecisionContext['weightsMode']): WeightsSource {
  if (mode === 'из данных') return 'learned'
  if (mode === 'смешанный') return 'mixed'
  return 'manual'
}

function toEncoded(ctx: DecisionContext): EncodedContext {
  return {
    s: ctx.sourceTool,
    l: ctx.leverKey,
    d: Number(ctx.delta.toFixed(3)),
    h: ctx.horizonDays,
    w: ctx.waves,
    wm: ctx.weightsMode,
    m: ctx.mixValue !== undefined ? Number(ctx.mixValue.toFixed(2)) : undefined,
    sp: ctx.shockProfile,
    n: ctx.noiseLevel,
    y: ctx.whyEdges?.slice(0, 3),
    r: ctx.riskNote,
    c: ctx.confidenceLabel,
  }
}

function fromEncoded(value: EncodedContext): DecisionContext {
  return {
    sourceTool: value.s,
    leverKey: value.l,
    delta: value.d,
    horizonDays: value.h,
    waves: value.w,
    weightsMode: value.wm,
    mixValue: value.m,
    shockProfile: value.sp,
    noiseLevel: value.n,
    whyEdges: value.y,
    riskNote: value.r,
    confidenceLabel: value.c,
  }
}

function toBase64Url(input: string): string {
  return window.btoa(unescape(encodeURIComponent(input))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return decodeURIComponent(escape(window.atob(padded)))
}

export function encodeContextToQuery(ctx: DecisionContext): string {
  const params = new URLSearchParams()
  params.set(QUERY_KEY, toBase64Url(JSON.stringify(toEncoded(ctx))))
  return params.toString()
}

export function decodeContextFromQuery(search: string): DecisionContext | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const raw = params.get(QUERY_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as EncodedContext
    if (!parsed?.l || typeof parsed?.d !== 'number') return null
    return fromEncoded(parsed)
  } catch {
    return null
  }
}
