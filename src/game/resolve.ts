import { getRole } from './roles'
import type { Death, DeathCause, GameState, Player, Winner } from './types'

export const CAUSE_TEXT: Record<DeathCause, string> = {
  lobos: 'devorado por los lobos',
  veneno: 'envenenado por la bruja',
  votacion: 'linchado por el pueblo',
  cazador: 'por el disparo del cazador',
  amor: 'de pena por su amor',
  narrador: 'por decisión del narrador',
}

/**
 * Aplica muertes y encadena las consecuencias: si muere un amante muere el otro,
 * si muere un cazador queda pendiente su disparo. No decide la fase siguiente.
 */
export function applyDeaths(state: GameState, initial: Death[]): GameState {
  const players: Player[] = state.players.map((p) => ({ ...p }))
  const pendingHunters = [...state.pendingHunters]
  const log = [...state.log]
  const deaths: Death[] = []
  const queue = [...initial]

  while (queue.length) {
    const death = queue.shift() as Death
    const p = players.find((x) => x.id === death.playerId)
    if (!p || !p.alive) continue

    p.alive = false
    p.death = { cause: death.cause, round: state.round }
    deaths.push(death)
    log.push({
      round: state.round,
      text: `${p.name} (${getRole(p.roleId).name}) muere: ${CAUSE_TEXT[death.cause]}.`,
    })

    if (p.roleId === 'cazador') pendingHunters.push(p.id)
    if (state.lovers && state.lovers.includes(p.id)) {
      const other = state.lovers[0] === p.id ? state.lovers[1] : state.lovers[0]
      queue.push({ playerId: other, cause: 'amor' })
    }
  }

  return { ...state, players, pendingHunters, lastDeaths: deaths, log }
}

/** Quién ha ganado, o `null` si la partida sigue. */
export function checkWinner(players: Player[], lovers: [string, string] | null): Winner | null {
  const alive = players.filter((p) => p.alive)
  if (alive.length === 0) return 'nadie'

  const isWolf = (p: Player) => getRole(p.roleId).team === 'lobos'

  if (lovers && alive.length === 2 && alive.every((p) => lovers.includes(p.id))) {
    // Si son del mismo bando, gana ese bando de forma normal.
    if (isWolf(alive[0]) !== isWolf(alive[1])) return 'amantes'
  }

  const wolves = alive.filter(isWolf).length
  const others = alive.length - wolves
  if (wolves === 0) return 'villa'
  if (wolves >= others) return 'lobos'
  return null
}
