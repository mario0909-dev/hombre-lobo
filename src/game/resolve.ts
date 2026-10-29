import { isWolf } from './night'
import { getRole } from './roles'
import type { Death, DeathCause, GameState, Player, Winner } from './types'

export const CAUSE_TEXT: Record<DeathCause, string> = {
  lobos: 'devorado por los lobos',
  loboBlanco: 'devorado por el lobo blanco',
  veneno: 'envenenado por la bruja',
  votacion: 'linchado por el pueblo',
  chivo: 'sacrificado como chivo expiatorio',
  cazador: 'por el disparo del cazador',
  amor: 'de pena por su amor',
  oxido: 'de tétanos por la espada oxidada',
  narrador: 'por decisión del narrador',
}

/** Muertes a manos del pueblo: si una de ellas es la del anciano, los aldeanos pierden sus poderes. */
const VILLAGE_KILLS: DeathCause[] = ['votacion', 'cazador', 'veneno']

/** Primer lobo vivo sentado después de `index` (dando la vuelta a la mesa). */
function nextWolfAfter(players: Player[], index: number): Player | undefined {
  const n = players.length
  for (let k = 1; k < n; k++) {
    const p = players[(index + k) % n]
    if (p.alive && isWolf(p)) return p
  }
  return undefined
}

/**
 * Aplica muertes y encadena las consecuencias: amantes, disparo del cazador, poderes
 * perdidos por el anciano, niño salvaje, óxido del caballero y sucesión del alguacil.
 * No decide la fase siguiente.
 */
export function applyDeaths(state: GameState, initial: Death[]): GameState {
  const players: Player[] = state.players.map((p) => ({ ...p }))
  const pendingHunters = [...state.pendingHunters]
  const log = [...state.log]
  const deaths: Death[] = []
  const queue = [...initial]
  let { villagePowersLost, rustNext, sheriff } = state
  const say = (text: string) => log.push({ round: state.round, text })
  const powered = (p: Player) => !(villagePowersLost && getRole(p.roleId).villagePower)

  while (queue.length) {
    const death = queue.shift() as Death
    const index = players.findIndex((x) => x.id === death.playerId)
    const p = players[index]
    if (!p || !p.alive) continue

    p.alive = false
    p.death = { cause: death.cause, round: state.round }
    deaths.push(death)
    say(`${p.name} (${getRole(p.roleId).name}) muere: ${CAUSE_TEXT[death.cause]}.`)

    if (p.roleId === 'cazador' && powered(p)) pendingHunters.push(p.id)
    if (state.lovers && state.lovers.includes(p.id)) {
      const other = state.lovers[0] === p.id ? state.lovers[1] : state.lovers[0]
      queue.push({ playerId: other, cause: 'amor' })
    }
    if (p.roleId === 'anciano' && VILLAGE_KILLS.includes(death.cause) && !villagePowersLost) {
      villagePowersLost = true
      say('El pueblo ha matado al anciano: los aldeanos pierden sus poderes.')
    }
    if (p.id === state.wildChildModel) {
      const child = players.find((x) => x.roleId === 'ninoSalvaje' && x.alive && !x.wolf)
      if (child) {
        child.wolf = true
        say(`Ha muerto el modelo de ${child.name}: el niño salvaje se convierte en hombre lobo.`)
      }
    }
    if (p.roleId === 'caballero' && death.cause === 'lobos' && powered(p)) {
      const wolf = nextWolfAfter(players, index)
      if (wolf) {
        rustNext = wolf.id
        say(`La espada oxidada del caballero hiere a ${wolf.name}: morirá la próxima noche.`)
      }
    }
    if (p.id === sheriff) {
      sheriff = null
      say(`${p.name} era el alguacil: debe nombrar a su sucesor.`)
    }
  }

  return { ...state, players, pendingHunters, lastDeaths: deaths, log, villagePowersLost, rustNext, sheriff }
}

export interface WinContext {
  enchanted?: string[]
  sect?: string[] | null
}

/** Bando a efectos de la victoria de los enamorados: los solitarios van cada uno por su cuenta. */
function camp(p: Player): string {
  if (isWolf(p)) return 'lobos'
  return getRole(p.roleId).team === 'solitario' ? p.id : 'villa'
}

/** Quién ha ganado, o `null` si la partida sigue. */
export function checkWinner(players: Player[], lovers: [string, string] | null, ctx: WinContext = {}): Winner | null {
  const alive = players.filter((p) => p.alive)
  if (alive.length === 0) return 'nadie'

  // El ángel gana si muere en la primera ronda (noche 1 o primera votación).
  if (players.some((p) => p.roleId === 'angel' && p.death?.round === 1 && p.death.cause !== 'narrador')) return 'angel'

  if (lovers && alive.length === 2 && alive.every((p) => lovers.includes(p.id))) {
    // Si son del mismo bando, gana ese bando de forma normal.
    if (camp(alive[0]) !== camp(alive[1])) return 'amantes'
  }

  const piper = alive.find((p) => p.roleId === 'flautista')
  const enchanted = ctx.enchanted ?? []
  if (piper && alive.every((p) => p.id === piper.id || enchanted.includes(p.id))) return 'flautista'

  const sect = ctx.sect
  if (sect && alive.some((p) => p.roleId === 'sectario') && alive.every((p) => sect.includes(p.id))) return 'sectario'

  const whiteWolf = alive.find((p) => p.roleId === 'loboBlanco')
  if (whiteWolf && alive.length === 1) return 'loboBlanco'

  const wolves = alive.filter(isWolf).length
  const others = alive.length - wolves
  if (wolves === 0) return 'villa'
  // Con el lobo blanco vivo, los demás lobos no ganan: él aún puede quedarse solo.
  if (whiteWolf) return null
  if (wolves >= others) return 'lobos'
  return null
}
