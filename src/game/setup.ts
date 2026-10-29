import { ACTOR_ROLES, ROLES } from './roles'
import { buildNightSteps } from './steps'
import { GameRuleError } from './types'
import type { GameState, HouseRules, RoleCounts, RoleId } from './types'

export const MIN_PLAYERS = 4

/** Cartas de más que se reparten cuando juega el ladrón. */
export const THIEF_EXTRA_CARDS = 2

export const DEFAULT_RULES: HouseRules = {
  guardianCanSelfProtect: true,
  guardianCanRepeat: false,
  doubleSave: 'survives',
  witchCanSelfSave: true,
  witchBothPotionsSameNight: true,
  sheriff: false,
}

export type Rng = () => number

/** Un nombre por línea; recorta espacios y descarta líneas vacías. */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Reparto recomendado de roles especiales (sin contar aldeanos). */
export function suggestRoleCounts(playerCount: number): RoleCounts {
  const n = playerCount
  const counts: RoleCounts = { lobo: Math.max(1, Math.floor(n / 4)) }
  if (n >= 5) counts.vidente = 1
  if (n >= 7) counts.bruja = 1
  if (n >= 8) counts.cazador = 1
  if (n >= 9) counts.cupido = 1
  if (n >= 10) counts.guardian = 1
  return counts
}

export function specialRoleTotal(counts: RoleCounts): number {
  return Object.entries(counts).reduce(
    (sum, [id, n]) => (id === 'aldeano' ? sum : sum + (n ?? 0)),
    0,
  )
}

/** Cuántas cartas hay en total: una por jugador más las del ladrón. */
export function cardTotal(playerCount: number, counts: RoleCounts): number {
  return playerCount + ((counts.ladron ?? 0) > 0 ? THIEF_EXTRA_CARDS : 0)
}

/** Las tres cartas del comediante: las primeras de su lista que no estén ya en juego. */
export function pickActorCards(inPlay: RoleId[]): RoleId[] {
  return ACTOR_ROLES.filter((r) => !inPlay.includes(r)).slice(0, 3)
}

/**
 * Devuelve la lista de problemas (vacía si el reparto es válido). `counts` incluye
 * todas las cartas, también las dos sobrantes del ladrón si juega.
 */
export function validateSetup(names: string[], counts: RoleCounts): string[] {
  const errors: string[] = []
  const n = names.length

  if (n < MIN_PLAYERS) errors.push(`Hacen falta al menos ${MIN_PLAYERS} jugadores.`)

  const seen = new Map<string, string>()
  const dupes = new Set<string>()
  for (const name of names) {
    const key = name.trim().toLocaleLowerCase('es')
    if (seen.has(key)) dupes.add(seen.get(key) as string)
    else seen.set(key, name)
  }
  if (dupes.size) errors.push(`Hay nombres repetidos: ${[...dupes].join(', ')}.`)

  const specials = specialRoleTotal(counts)
  const cards = cardTotal(n, counts)
  if (specials > cards) errors.push(`Hay más roles (${specials}) que cartas (${cards}).`)

  const count = (team: 'lobos') => ROLES.filter((r) => r.team === team).reduce((sum, r) => sum + (counts[r.id] ?? 0), 0)
  const wolves = count('lobos')
  const wolfish = wolves + (counts.loboBlanco ?? 0)
  if (wolves < 1) errors.push('Tiene que haber al menos un hombre lobo.')
  else if (n >= MIN_PLAYERS && wolfish * 2 >= n) {
    errors.push('Con tantos lobos, ganarían desde el principio. Reduce el número de lobos.')
  }

  for (const role of ROLES) {
    const c = counts[role.id] ?? 0
    if (role.max !== null && c > role.max) {
      errors.push(
        role.max === 1
          ? `Solo puede haber un jugador con el rol ${role.name}.`
          : `Como mucho puede haber ${role.max} cartas de ${role.name}.`,
      )
    }
    if (role.exactly && c > 0 && c !== role.exactly) {
      errors.push(`${role.name}: se juega con exactamente ${role.exactly} cartas.`)
    }
  }

  if ((counts.comediante ?? 0) > 0) {
    const inPlay = (Object.keys(counts) as RoleId[]).filter((id) => (counts[id] ?? 0) > 0)
    if (pickActorCards(inPlay).length < 3) errors.push('No quedan tres cartas libres para el comediante.')
  }
  return errors
}

/** Barajado Fisher-Yates. El azar entra por `rng` para que las reglas sigan siendo puras. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Baraja todas las cartas, rellenando con aldeanos. Devuelve una por jugador y,
 * si juega el ladrón, las dos que sobran.
 */
export function dealCards(playerCount: number, counts: RoleCounts, rng: Rng): { roles: RoleId[]; thiefCards: RoleId[] } {
  const total = cardTotal(playerCount, counts)
  const specials = specialRoleTotal(counts)
  if (specials > total) {
    throw new GameRuleError(`Hay más roles (${specials}) que cartas (${total}).`)
  }
  const pool: RoleId[] = []
  for (const [id, n] of Object.entries(counts)) {
    if (id === 'aldeano') continue
    for (let i = 0; i < (n ?? 0); i++) pool.push(id as RoleId)
  }
  while (pool.length < total) pool.push('aldeano')
  let deck = shuffle(pool, rng)
  // El ladrón tiene que acabar en manos de un jugador, no entre las sobrantes.
  const thiefAt = deck.indexOf('ladron')
  if (thiefAt >= playerCount) {
    const swapWith = Math.floor(rng() * playerCount)
    deck = [...deck]
    ;[deck[thiefAt], deck[swapWith]] = [deck[swapWith], deck[thiefAt]]
  }
  return { roles: deck.slice(0, playerCount), thiefCards: deck.slice(playerCount) }
}

/** Lista de roles ya barajada, una por jugador (sin las cartas sobrantes del ladrón). */
export function dealRoles(playerCount: number, counts: RoleCounts, rng: Rng): RoleId[] {
  return dealCards(playerCount, counts, rng).roles
}

export interface Assignment {
  name: string
  roleId: RoleId
}

export function countRoles(assignments: Assignment[], extra: RoleId[] = []): RoleCounts {
  const counts: RoleCounts = {}
  for (const roleId of [...assignments.map((a) => a.roleId), ...extra]) counts[roleId] = (counts[roleId] ?? 0) + 1
  return counts
}

/**
 * Crea la partida ya en la primera noche. Los roles vienen decididos (al azar o a mano).
 * `thiefCards`: las dos cartas sobrantes si juega el ladrón (por defecto, dos aldeanos).
 */
export function createGame(
  assignments: Assignment[],
  rules: HouseRules = DEFAULT_RULES,
  thiefCards: RoleId[] = [],
): GameState {
  const hasThief = assignments.some((a) => a.roleId === 'ladron')
  const extra: RoleId[] = hasThief
    ? thiefCards.length === THIEF_EXTRA_CARDS
      ? thiefCards
      : ['aldeano', 'aldeano']
    : []
  const names = assignments.map((a) => a.name)
  const errors = validateSetup(names, countRoles(assignments, extra))
  if (errors.length) throw new GameRuleError(errors.join(' '))

  const players = assignments.map((a, i) => ({
    id: `p${i + 1}`,
    name: a.name,
    roleId: a.roleId,
    alive: true,
  }))
  const inPlay = [...assignments.map((a) => a.roleId), ...extra]
  const state: GameState = {
    version: 2,
    phase: 'night',
    round: 1,
    players,
    rules: { ...rules },
    night: { steps: [], stepIndex: 0, actions: {} },
    lovers: null,
    witch: { lifeUsed: false, deathUsed: false },
    guardianLast: null,
    thiefCards: extra,
    actorCards: inPlay.includes('comediante') ? pickActorCards(inPlay) : [],
    elderHit: false,
    villagePowersLost: false,
    idiotRevealed: false,
    infectUsed: false,
    foxPowerLost: false,
    wildChildModel: null,
    enchanted: [],
    sect: null,
    rustNext: null,
    ravenMark: null,
    medium: null,
    judge: { used: false, secondVote: false },
    sheriff: null,
    lastDeaths: [],
    pendingHunters: [],
    afterHunter: 'day',
    winner: null,
    log: [{ round: 1, text: 'Empieza la partida.' }],
  }
  return { ...state, night: { ...state.night, steps: buildNightSteps(state) } }
}
