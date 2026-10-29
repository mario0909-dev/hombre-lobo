import { describe, expect, it } from 'vitest'
import {
  aplicar,
  createGame,
  currentStep,
  dealCards,
  DEFAULT_RULES,
  GameRuleError,
  ROLES,
  shuffle,
  suggestRoleCounts,
  validateSetup,
  validTargets,
} from './index'
import type { Action, GameState, HouseRules, RoleCounts, RoleId } from './types'
import { seeded } from './testUtils'

const pick = <T,>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)]
const maybe = (rng: () => number, p: number) => rng() < p

/** Un "narrador" que juega al azar con acciones válidas (y alguna inválida, que se ignora). */
function botActions(s: GameState, rng: () => number): Action[] {
  const alive = s.players.filter((p) => p.alive)
  const orNull = (ids: { id: string }[], p = 0.8) => (ids.length && maybe(rng, p) ? pick(ids, rng).id : null)
  switch (s.phase) {
    case 'night': {
      const step = currentStep(s)
      const next: Action = { type: 'SIGUIENTE_PASO' }
      switch (step) {
        case 'ladron':
          return [{ type: 'LADRON_ELIGE', card: maybe(rng, 0.3) ? null : pick([0, 1], rng) }, { type: 'LADRON_ELIGE', card: 0 }, next]
        case 'comediante':
          return [{ type: 'COMEDIANTE_ELIGE', role: maybe(rng, 0.7) ? pick(s.actorCards, rng) : null }, next]
        case 'perroLobo':
          return [{ type: 'PERRO_LOBO_ELIGE', side: pick(['villa', 'lobos'] as const, rng) }, next]
        case 'cupido': {
          const [a, b] = [pick(alive, rng), pick(alive, rng)]
          return [{ type: 'CUPIDO_ELIGE', a: a.id, b: b.id }, { type: 'CUPIDO_ELIGE', a: alive[0].id, b: alive[1].id }, next]
        }
        case 'ninoSalvaje':
          return [{ type: 'NINO_SALVAJE_ELIGE', target: pick(validTargets(s, 'ninoSalvaje'), rng).id }, next]
        case 'sectario':
          return [{ type: 'SECTARIO_GRUPO', ids: alive.filter(() => maybe(rng, 0.4)).map((p) => p.id) }, { type: 'SECTARIO_GRUPO', ids: [] }, next]
        case 'guardian':
          return [{ type: 'GUARDIAN_ELIGE', target: orNull(validTargets(s, 'guardian')) }, next]
        case 'lobo':
          return [
            { type: 'LOBOS_ELIGEN', target: orNull(alive, 0.9) },
            { type: 'LOBOS_INFECTAN', infect: maybe(rng, 0.3) },
            next,
          ]
        case 'loboFeroz':
          return [{ type: 'LOBO_FEROZ_ELIGE', target: orNull(validTargets(s, 'loboFeroz')) }, next]
        case 'loboBlanco':
          return [{ type: 'LOBO_BLANCO_ELIGE', target: orNull(validTargets(s, 'loboBlanco'), 0.5) }, next]
        case 'vidente': {
          const t = validTargets(s, 'vidente')
          return [...(t.length ? [{ type: 'VIDENTE_ELIGE', target: pick(t, rng).id } as Action] : []), next]
        }
        case 'zorro':
          return [{ type: 'ZORRO_ELIGE', target: orNull(alive) }, next]
        case 'bruja': {
          const acts: Action[] = []
          if (maybe(rng, 0.5)) acts.push({ type: 'BRUJA_SALVA', save: true })
          if (maybe(rng, 0.5)) acts.push({ type: 'BRUJA_ENVENENA', target: pick(alive, rng).id })
          return [...acts, next]
        }
        case 'flautista': {
          const t = shuffle(validTargets(s, 'flautista'), rng)
          return [...(t.length ? [{ type: 'FLAUTISTA_ELIGE', targets: t.slice(0, 2).map((p) => p.id) } as Action] : []), next]
        }
        case 'cuervo':
          return [{ type: 'CUERVO_ELIGE', target: orNull(alive, 0.6) }, next]
        case 'gitana':
          return [{ type: 'GITANA_ELIGE', target: orNull(alive, 0.6) }, next]
        default:
          return [next]
      }
    }
    case 'dawn':
      return [
        ...(s.rules.sheriff && !s.sheriff ? [{ type: 'ALGUACIL_NOMBRA', playerId: pick(alive, rng).id } as Action] : []),
        { type: 'CONTINUAR' },
      ]
    case 'hunter': {
      const shooter = s.pendingHunters[0]
      const targets = alive.filter((p) => p.id !== shooter)
      return [{ type: 'CAZADOR_DISPARA', target: orNull(targets) }]
    }
    case 'day':
      return [
        ...(maybe(rng, 0.2) ? [{ type: 'JUEZ_SEGUNDA_VOTACION' } as Action] : []),
        { type: 'VOTAR_LINCHAMIENTO', target: orNull(alive, 0.9), servant: maybe(rng, 0.2) },
        { type: 'VOTAR_LINCHAMIENTO', target: orNull(alive, 0.9) },
      ]
    default:
      return []
  }
}

/** Intenta cada acción; una acción inválida debe lanzar GameRuleError y dejar el estado intacto. */
function step(s: GameState, actions: Action[]): GameState {
  let cur = s
  for (const a of actions) {
    const before = JSON.stringify(cur)
    try {
      cur = aplicar(cur, a)
    } catch (e) {
      expect(e).toBeInstanceOf(GameRuleError)
      expect(JSON.stringify(cur)).toBe(before)
    }
  }
  return cur
}

function checkInvariants(s: GameState, playerCount: number) {
  expect(s.players).toHaveLength(playerCount)
  expect(new Set(s.players.map((p) => p.id)).size).toBe(playerCount)
  for (const p of s.players) expect(p.alive).toBe(p.death === undefined)
  expect(s.winner !== null).toBe(s.phase === 'gameOver')
  if (s.lovers && s.phase !== 'hunter') {
    const [a, b] = s.lovers.map((id) => s.players.find((p) => p.id === id)) as GameState['players']
    expect(a.alive).toBe(b.alive)
  }
  if (s.phase !== 'hunter' && s.phase !== 'dawn') expect(s.pendingHunters).toEqual([])
  if (s.phase === 'night') expect(s.night.steps[0]).toBe('inicio')
  expect(JSON.parse(JSON.stringify(s))).toEqual(s)
}

/** Reparto recomendado más unos cuantos personajes de las ampliaciones al azar (si caben). */
function randomCounts(n: number, rng: () => number): RoleCounts {
  const counts: RoleCounts = { ...suggestRoleCounts(n) }
  const extras = shuffle(ROLES.filter((r) => r.id !== 'aldeano' && r.id !== 'lobo' && !counts[r.id]), rng)
  for (const role of extras.slice(0, Math.floor(rng() * 6))) {
    const tryCounts = { ...counts, [role.id]: role.exactly ?? 1 }
    if (validateSetup(Array.from({ length: n }, (_, i) => `J${i}`), tryCounts).length === 0) Object.assign(counts, tryCounts)
  }
  return counts
}

describe('partidas aleatorias (fuzz)', () => {
  const ruleSets: HouseRules[] = [
    DEFAULT_RULES,
    { ...DEFAULT_RULES, doubleSave: 'dies', guardianCanRepeat: true, sheriff: true },
    { ...DEFAULT_RULES, guardianCanSelfProtect: false, witchCanSelfSave: false, witchBothPotionsSameNight: false },
  ]

  it('500 partidas con todo tipo de personajes terminan siempre y cumplen los invariantes', () => {
    const winners = new Set<string>()
    const seen = new Set<RoleId>()
    for (let seed = 1; seed <= 500; seed++) {
      const rng = seeded(seed)
      const n = 5 + Math.floor(rng() * 16)
      const { roles, thiefCards } = dealCards(n, randomCounts(n, rng), rng)
      roles.forEach((r) => seen.add(r))
      let s = createGame(
        roles.map((roleId, i) => ({ name: `J${i + 1}`, roleId })),
        ruleSets[seed % ruleSets.length],
        thiefCards,
      )
      let guard = 0
      while (s.phase !== 'gameOver') {
        if (guard++ > 3000) throw new Error(`La partida con semilla ${seed} no termina`)
        s = step(s, botActions(s, rng))
        checkInvariants(s, n)
      }
      winners.add(s.winner as string)
    }
    // Se han probado todos los personajes y varios finales distintos.
    expect([...seen].sort()).toEqual(ROLES.map((r) => r.id).sort())
    expect(winners.size).toBeGreaterThanOrEqual(5)
  })
})
