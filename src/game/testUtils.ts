import { aplicar } from './reducer'
import { currentStep, validTargets } from './night'
import { createGame, DEFAULT_RULES } from './setup'
import type { Action, GameState, HouseRules, NightStepId, RoleId } from './types'

/** Partida de prueba: los jugadores se llaman J1, J2… con ids p1, p2… */
export function game(roles: RoleId[], rules: Partial<HouseRules> = {}, thiefCards: RoleId[] = []): GameState {
  return createGame(
    roles.map((roleId, i) => ({ name: `J${i + 1}`, roleId })),
    { ...DEFAULT_RULES, ...rules },
    thiefCards,
  )
}

export function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce(aplicar, state)
}

export interface NightPlan {
  /** Por defecto, el ladrón se queda su carta. */
  ladron?: number | null
  comediante?: RoleId | null
  /** Por defecto, el perro lobo elige ser aldeano. */
  perroLobo?: 'villa' | 'lobos'
  cupido?: [string, string]
  /** Por defecto, el primer jugador válido. */
  ninoSalvaje?: string
  /** Por defecto, el sectario solo (todos los demás en el grupo rival). */
  sectario?: string[]
  guardian?: string | null
  /** Por defecto, los lobos no matan a nadie. */
  lobo?: string | null
  infectar?: boolean
  loboFeroz?: string | null
  loboBlanco?: string | null
  vidente?: string
  zorro?: string | null
  brujaSalva?: boolean
  brujaVeneno?: string | null
  /** Por defecto, los dos primeros jugadores válidos. */
  flautista?: string[]
  cuervo?: string | null
  gitana?: string | null
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
    if (step === 'ladron') s = aplicar(s, { type: 'LADRON_ELIGE', card: plan.ladron ?? null })
    if (step === 'comediante' && plan.comediante !== undefined) s = aplicar(s, { type: 'COMEDIANTE_ELIGE', role: plan.comediante })
    if (step === 'perroLobo') s = aplicar(s, { type: 'PERRO_LOBO_ELIGE', side: plan.perroLobo ?? 'villa' })
    if (step === 'cupido' && plan.cupido) s = aplicar(s, { type: 'CUPIDO_ELIGE', a: plan.cupido[0], b: plan.cupido[1] })
    if (step === 'ninoSalvaje') {
      s = aplicar(s, { type: 'NINO_SALVAJE_ELIGE', target: plan.ninoSalvaje ?? validTargets(s, 'ninoSalvaje')[0].id })
    }
    if (step === 'sectario') s = aplicar(s, { type: 'SECTARIO_GRUPO', ids: plan.sectario ?? [] })
    if (step === 'guardian' && plan.guardian !== undefined) s = aplicar(s, { type: 'GUARDIAN_ELIGE', target: plan.guardian })
    if (step === 'lobo') {
      s = aplicar(s, { type: 'LOBOS_ELIGEN', target: plan.lobo ?? null })
      if (plan.infectar) s = aplicar(s, { type: 'LOBOS_INFECTAN', infect: true })
    }
    if (step === 'loboFeroz' && plan.loboFeroz !== undefined) s = aplicar(s, { type: 'LOBO_FEROZ_ELIGE', target: plan.loboFeroz })
    if (step === 'loboBlanco' && plan.loboBlanco !== undefined) s = aplicar(s, { type: 'LOBO_BLANCO_ELIGE', target: plan.loboBlanco })
    if (step === 'vidente' && plan.vidente) s = aplicar(s, { type: 'VIDENTE_ELIGE', target: plan.vidente })
    if (step === 'zorro' && plan.zorro !== undefined) s = aplicar(s, { type: 'ZORRO_ELIGE', target: plan.zorro })
    if (step === 'bruja') {
      if (plan.brujaSalva !== undefined) s = aplicar(s, { type: 'BRUJA_SALVA', save: plan.brujaSalva })
      if (plan.brujaVeneno !== undefined) s = aplicar(s, { type: 'BRUJA_ENVENENA', target: plan.brujaVeneno })
    }
    if (step === 'flautista') {
      const targets = plan.flautista ?? validTargets(s, 'flautista').slice(0, 2).map((p) => p.id)
      if (targets.length) s = aplicar(s, { type: 'FLAUTISTA_ELIGE', targets })
    }
    if (step === 'cuervo' && plan.cuervo !== undefined) s = aplicar(s, { type: 'CUERVO_ELIGE', target: plan.cuervo })
    if (step === 'gitana' && plan.gitana !== undefined) s = aplicar(s, { type: 'GITANA_ELIGE', target: plan.gitana })
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
