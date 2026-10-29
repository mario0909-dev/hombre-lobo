import { describe, expect, it } from 'vitest'
import {
  aplicar,
  createGame,
  currentStep,
  dealRoles,
  DEFAULT_RULES,
  GameRuleError,
  suggestRoleCounts,
  validTargets,
} from './index'
import type { Action, GameState, HouseRules } from './types'
import { seeded } from './testUtils'

const pick = <T,>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)]

/** Un "narrador" que juega al azar con acciones válidas (y alguna inválida, que se ignora). */
function botActions(s: GameState, rng: () => number): Action[] {
  const alive = s.players.filter((p) => p.alive)
  switch (s.phase) {
    case 'night': {
      const step = currentStep(s)
      const next: Action = { type: 'SIGUIENTE_PASO' }
      if (step === 'cupido') {
        const [a, b] = [pick(alive, rng), pick(alive, rng)]
        return [{ type: 'CUPIDO_ELIGE', a: a.id, b: b.id }, next]
      }
      if (step === 'guardian') {
        const t = validTargets(s, 'guardian')
        return [{ type: 'GUARDIAN_ELIGE', target: t.length && rng() < 0.8 ? pick(t, rng).id : null }, next]
      }
      if (step === 'lobo') return [{ type: 'LOBOS_ELIGEN', target: rng() < 0.1 ? null : pick(alive, rng).id }, next]
      if (step === 'vidente') {
        const t = validTargets(s, 'vidente')
        return [...(t.length ? [{ type: 'VIDENTE_ELIGE', target: pick(t, rng).id } as Action] : []), next]
      }
      if (step === 'bruja') {
        const acts: Action[] = []
        if (rng() < 0.5) acts.push({ type: 'BRUJA_SALVA', save: true })
        if (rng() < 0.5) acts.push({ type: 'BRUJA_ENVENENA', target: pick(alive, rng).id })
        return [...acts, next]
      }
      return [next]
    }
    case 'dawn':
      return [{ type: 'CONTINUAR' }]
    case 'hunter': {
      const shooter = s.pendingHunters[0]
      const targets = alive.filter((p) => p.id !== shooter)
      return [{ type: 'CAZADOR_DISPARA', target: targets.length && rng() < 0.8 ? pick(targets, rng).id : null }]
    }
    case 'day':
      return [{ type: 'VOTAR_LINCHAMIENTO', target: rng() < 0.1 ? null : pick(alive, rng).id }]
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
  expect(JSON.parse(JSON.stringify(s))).toEqual(s)
}

describe('partidas aleatorias (fuzz)', () => {
  const ruleSets: HouseRules[] = [
    DEFAULT_RULES,
    { ...DEFAULT_RULES, doubleSave: 'dies', guardianCanRepeat: true },
    { ...DEFAULT_RULES, guardianCanSelfProtect: false, witchCanSelfSave: false, witchBothPotionsSameNight: false },
  ]

  it('300 partidas terminan siempre y cumplen los invariantes', () => {
    let finished = 0
    for (let seed = 1; seed <= 300; seed++) {
      const rng = seeded(seed)
      const n = 5 + Math.floor(rng() * 16)
      const roles = dealRoles(n, suggestRoleCounts(n), rng)
      let s = createGame(
        roles.map((roleId, i) => ({ name: `J${i + 1}`, roleId })),
        ruleSets[seed % ruleSets.length],
      )
      let guard = 0
      while (s.phase !== 'gameOver') {
        if (guard++ > 3000) throw new Error(`La partida con semilla ${seed} no termina`)
        s = step(s, botActions(s, rng))
        checkInvariants(s, n)
      }
      finished++
      expect(['villa', 'lobos', 'amantes', 'nadie']).toContain(s.winner)
    }
    expect(finished).toBe(300)
  })
})
