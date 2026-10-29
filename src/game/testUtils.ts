import { aplicar } from './reducer'
import { currentStep } from './night'
import { createGame, DEFAULT_RULES } from './setup'
import type { Action, GameState, HouseRules, NightStepId, RoleId } from './types'

/** Partida de prueba: los jugadores se llaman J1, J2… con ids p1, p2… */
export function game(roles: RoleId[], rules: Partial<HouseRules> = {}): GameState {
  return createGame(
    roles.map((roleId, i) => ({ name: `J${i + 1}`, roleId })),
    { ...DEFAULT_RULES, ...rules },
  )
}

export function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce(aplicar, state)
}

export interface NightPlan {
  cupido?: [string, string]
  guardian?: string | null
  /** Por defecto, los lobos no matan a nadie. */
  lobo?: string | null
  vidente?: string
  brujaSalva?: boolean
  brujaVeneno?: string | null
}

/**
 * Recorre la noche aplicando el plan hasta salir de la fase de noche,
 * o hasta llegar al paso `stopAt` (sin ejecutarlo).
 */
export function playNight(state: GameState, plan: NightPlan = {}, stopAt?: NightStepId): GameState {
  let s = state
  let guard = 0
  while (s.phase === 'night') {
    if (guard++ > 50) throw new Error('La noche no termina')
    const step = currentStep(s)
    if (stopAt && step === stopAt) return s
    if (step === 'cupido' && plan.cupido) s = aplicar(s, { type: 'CUPIDO_ELIGE', a: plan.cupido[0], b: plan.cupido[1] })
    if (step === 'guardian' && plan.guardian !== undefined) s = aplicar(s, { type: 'GUARDIAN_ELIGE', target: plan.guardian })
    if (step === 'lobo') s = aplicar(s, { type: 'LOBOS_ELIGEN', target: plan.lobo ?? null })
    if (step === 'vidente' && plan.vidente) s = aplicar(s, { type: 'VIDENTE_ELIGE', target: plan.vidente })
    if (step === 'bruja') {
      if (plan.brujaSalva !== undefined) s = aplicar(s, { type: 'BRUJA_SALVA', save: plan.brujaSalva })
      if (plan.brujaVeneno !== undefined) s = aplicar(s, { type: 'BRUJA_ENVENENA', target: plan.brujaVeneno })
    }
    s = aplicar(s, { type: 'SIGUIENTE_PASO' })
  }
  return s
}

/** Generador pseudoaleatorio con semilla (mulberry32) para tests reproducibles. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dead(state: GameState): string[] {
  return state.players.filter((p) => !p.alive).map((p) => p.id)
}
