import { getRole } from './roles'
import type { Death, GameState, Phase, RoleId, Winner } from './types'

export interface PublicPlayer {
  id: string
  name: string
  alive: boolean
  /** Solo si el espectador puede verlo. */
  roleId?: RoleId
}

export interface StateView {
  viewer: 'narrador' | string
  phase: Phase
  round: number
  players: PublicPlayer[]
  /** Datos del propio jugador (no existe para el narrador). */
  me?: { id: string; name: string; roleId: RoleId; alive: boolean; partnerId?: string }
  lastDeaths: Death[]
  winner: Winner | null
  /** Estado completo: solo lo recibe el narrador. */
  full: GameState | null
}

/**
 * Qué puede ver cada espectador. El narrador lo ve todo. Un jugador ve su propio rol,
 * a sus compañeros lobos (si es lobo), el rol de los muertos y, al acabar, todos.
 */
export function vistaPara(state: GameState, viewer: 'narrador' | string): StateView {
  const base = {
    viewer,
    phase: state.phase,
    round: state.round,
    lastDeaths: state.lastDeaths,
    winner: state.winner,
  }

  if (viewer === 'narrador') {
    return {
      ...base,
      players: state.players.map((p) => ({ id: p.id, name: p.name, alive: p.alive, roleId: p.roleId })),
      full: state,
    }
  }

  const me = state.players.find((p) => p.id === viewer)
  if (!me) throw new Error(`Jugador desconocido: ${viewer}`)
  const meIsWolf = getRole(me.roleId).team === 'lobos'
  const over = state.phase === 'gameOver'

  const players = state.players.map((p) => {
    const visible =
      over ||
      !p.alive ||
      p.id === me.id ||
      (meIsWolf && getRole(p.roleId).team === 'lobos')
    return { id: p.id, name: p.name, alive: p.alive, ...(visible ? { roleId: p.roleId } : {}) }
  })

  const partnerId = state.lovers?.includes(me.id)
    ? state.lovers[0] === me.id
      ? state.lovers[1]
      : state.lovers[0]
    : undefined

  return {
    ...base,
    players,
    me: { id: me.id, name: me.name, roleId: me.roleId, alive: me.alive, ...(partnerId ? { partnerId } : {}) },
    full: null,
  }
}
