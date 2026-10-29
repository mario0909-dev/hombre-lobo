import { buildNightSteps } from './night'
import { getRole } from './roles'
import { GameRuleError } from './types'
import type { GameState, HouseRules, RoleCounts, RoleId } from './types'

export const MIN_PLAYERS = 4

export const DEFAULT_RULES: HouseRules = {
  guardianCanSelfProtect: true,
  guardianCanRepeat: false,
  doubleSave: 'survives',
  witchCanSelfSave: true,
  witchBothPotionsSameNight: true,
}

/** Roles que solo pueden aparecer una vez (sus poderes son de un solo jugador). */
const UNIQUE_ROLES: RoleId[] = ['vidente', 'bruja', 'cazador', 'cupido', 'guardian', 'nina']

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

/** Devuelve la lista de problemas (vacía si el reparto es válido). */
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
  if (specials > n) errors.push(`Hay más roles (${specials}) que jugadores (${n}).`)

  const wolves = counts.lobo ?? 0
  if (wolves < 1) errors.push('Tiene que haber al menos un hombre lobo.')
  else if (n >= MIN_PLAYERS && wolves * 2 >= n) {
    errors.push('Con tantos lobos, ganarían desde el principio. Reduce el número de lobos.')
  }

  for (const id of UNIQUE_ROLES) {
    if ((counts[id] ?? 0) > 1) errors.push(`Solo puede haber un jugador con el rol ${getRole(id).name}.`)
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

/** Lista de roles ya barajada, de longitud `playerCount`, rellenando con aldeanos. */
export function dealRoles(playerCount: number, counts: RoleCounts, rng: Rng): RoleId[] {
  const specials = specialRoleTotal(counts)
  if (specials > playerCount) {
    throw new GameRuleError(`Hay más roles (${specials}) que jugadores (${playerCount}).`)
  }
  const pool: RoleId[] = []
  for (const [id, n] of Object.entries(counts)) {
    if (id === 'aldeano') continue
    for (let i = 0; i < (n ?? 0); i++) pool.push(id as RoleId)
  }
  while (pool.length < playerCount) pool.push('aldeano')
  return shuffle(pool, rng)
}

export interface Assignment {
  name: string
  roleId: RoleId
}

export function countRoles(assignments: Assignment[]): RoleCounts {
  const counts: RoleCounts = {}
  for (const a of assignments) counts[a.roleId] = (counts[a.roleId] ?? 0) + 1
  return counts
}

/** Crea la partida ya en la primera noche. Los roles vienen decididos (al azar o a mano). */
export function createGame(
  assignments: Assignment[],
  rules: HouseRules = DEFAULT_RULES,
): GameState {
  const names = assignments.map((a) => a.name)
  const errors = validateSetup(names, countRoles(assignments))
  if (errors.length) throw new GameRuleError(errors.join(' '))

  const players = assignments.map((a, i) => ({
    id: `p${i + 1}`,
    name: a.name,
    roleId: a.roleId,
    alive: true,
  }))
  return {
    version: 1,
    phase: 'night',
    round: 1,
    players,
    rules: { ...rules },
    night: { steps: buildNightSteps(players, 1), stepIndex: 0, actions: {} },
    lovers: null,
    witch: { lifeUsed: false, deathUsed: false },
    guardianLast: null,
    lastDeaths: [],
    pendingHunters: [],
    afterHunter: 'day',
    winner: null,
    log: [{ round: 1, text: 'Empieza la partida.' }],
  }
}
