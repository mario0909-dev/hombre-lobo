import { ROLES } from './roles'
import type { GameState, NightStepId, Player } from './types'

/** Pasos de la noche según los roles que siguen vivos. Los muertos no despiertan. */
export function buildNightSteps(players: Player[], round: number): NightStepId[] {
  const aliveRoles = new Set(players.filter((p) => p.alive).map((p) => p.roleId))
  const steps: NightStepId[] = ['inicio']
  const ordered = ROLES.filter(
    (r) =>
      r.nightOrder !== null &&
      aliveRoles.has(r.id) &&
      (!r.firstNightOnly || round === 1),
  ).sort((a, b) => (a.nightOrder ?? 0) - (b.nightOrder ?? 0))
  for (const role of ordered) {
    steps.push(role.id as NightStepId)
    if (role.id === 'cupido') steps.push('amantes')
  }
  return steps
}

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

/** Víctima de los lobos esta noche (si ya han elegido y hay víctima). */
export function wolfVictim(state: GameState): Player | null {
  const id = state.night.actions.lobo
  return id ? (playerById(state, id) ?? null) : null
}

/** Jugadores que se pueden señalar en un paso de la noche. */
export function validTargets(state: GameState, step: NightStepId): Player[] {
  const alive = alivePlayers(state)
  switch (step) {
    case 'cupido':
    case 'lobo':
      return alive
    case 'guardian': {
      const guardianIds = new Set(
        alive.filter((p) => p.roleId === 'guardian').map((p) => p.id),
      )
      return alive.filter((p) => {
        if (!state.rules.guardianCanSelfProtect && guardianIds.has(p.id)) return false
        if (!state.rules.guardianCanRepeat && p.id === state.guardianLast) return false
        return true
      })
    }
    case 'vidente':
      return alive.filter((p) => p.roleId !== 'vidente')
    case 'bruja':
      return alive.filter((p) => p.roleId !== 'bruja')
    default:
      return []
  }
}
