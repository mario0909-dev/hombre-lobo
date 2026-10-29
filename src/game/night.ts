import { getRole } from './roles'
import type { GameState, NightStepId, Player, RoleId } from './types'

export function currentStep(state: GameState): NightStepId | null {
  if (state.phase !== 'night') return null
  return state.night.steps[state.night.stepIndex] ?? null
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => p.alive)
}

export function playerById(state: GameState, id: string): Player | undefined {
  return state.players.find((p) => p.id === id)
}

export function nameOf(state: GameState, id: string | null | undefined): string {
  if (!id) return 'nadie'
  return playerById(state, id)?.name ?? '¿?'
}

/** Juega con los lobos: carta de lobo, lobo blanco o convertido (infectado, niño salvaje, perro lobo). */
export function isWolf(p: Player): boolean {
  return p.wolf === true || getRole(p.roleId).team === 'lobos' || p.roleId === 'loboBlanco'
}

/** Un aldeano con poder lo pierde si el pueblo mató al anciano. */
export function hasPower(state: GameState, p: Player): boolean {
  return !(state.villagePowersLost && getRole(p.roleId).villagePower)
}

/** Jugadores vivos que esta noche actúan como `role` (incluye al comediante que usa esa carta). */
export function actingAs(state: GameState, role: RoleId): Player[] {
  return alivePlayers(state).filter(
    (p) =>
      hasPower(state, p) &&
      (p.roleId === role || (p.roleId === 'comediante' && state.night.actions.comediante === role)),
  )
}

/** Vecinos vivos a cada lado, siguiendo el orden en que están sentados. */
export function aliveNeighbors(state: GameState, id: string): Player[] {
  const n = state.players.length
  const i = state.players.findIndex((p) => p.id === id)
  if (i < 0) return []
  const found: Player[] = []
  for (const dir of [-1, 1]) {
    for (let k = 1; k < n; k++) {
      const p = state.players[(i + dir * k + n * k) % n]
      if (p.id === id) break
      if (p.alive) {
        if (!found.includes(p)) found.push(p)
        break
      }
    }
  }
  return found
}

/** El zorro huele lobo si el señalado o alguno de sus vecinos vivos lo es. */
export function foxSmellsWolf(state: GameState, targetId: string): boolean {
  const target = playerById(state, targetId)
  if (!target) return false
  return [target, ...aliveNeighbors(state, targetId)].some(isWolf)
}

/** El oso gruñe si el domador vive, conserva su poder y tiene un lobo al lado. */
export function bearGrowls(state: GameState): boolean {
  const tamer = alivePlayers(state).find((p) => p.roleId === 'domador')
  if (!tamer || !hasPower(state, tamer)) return false
  return aliveNeighbors(state, tamer.id).some(isWolf)
}

/** Víctima de los lobos esta noche (si ya han elegido y hay víctima). */
export function wolfVictim(state: GameState): Player | null {
  const id = state.night.actions.lobo
  return id ? (playerById(state, id) ?? null) : null
}

/** Jugadores que se pueden señalar en un paso de la noche. */
export function validTargets(state: GameState, step: NightStepId): Player[] {
  const alive = alivePlayers(state)
  const notActing = (role: RoleId) => {
    const ids = new Set(actingAs(state, role).map((p) => p.id))
    return alive.filter((p) => !ids.has(p.id))
  }
  switch (step) {
    case 'cupido':
    case 'lobo':
    case 'sectario':
      return alive
    case 'guardian': {
      const guardianIds = new Set(actingAs(state, 'guardian').map((p) => p.id))
      return alive.filter((p) => {
        if (!state.rules.guardianCanSelfProtect && guardianIds.has(p.id)) return false
        if (!state.rules.guardianCanRepeat && p.id === state.guardianLast) return false
        return true
      })
    }
    case 'ninoSalvaje':
      return alive.filter((p) => p.roleId !== 'ninoSalvaje')
    case 'loboFeroz':
      return alive.filter((p) => !isWolf(p) && p.id !== state.night.actions.lobo)
    case 'loboBlanco':
      return alive.filter((p) => isWolf(p) && p.roleId !== 'loboBlanco')
    case 'vidente':
      return notActing('vidente')
    case 'zorro':
      return alive
    case 'bruja':
      return alive.filter((p) => p.roleId !== 'bruja')
    case 'flautista':
      return alive.filter((p) => p.roleId !== 'flautista' && !state.enchanted.includes(p.id))
    case 'cuervo':
      return alive
    case 'gitana':
      return alive
    default:
      return []
  }
}
