import { ROLES } from './roles'
import type { GameState } from './types'

const PHASES = ['night', 'dawn', 'hunter', 'day', 'gameOver']
const STEPS = ['inicio', 'cupido', 'amantes', 'guardian', 'lobo', 'vidente', 'bruja']
const WINNERS = ['villa', 'lobos', 'amantes', 'nadie']
const ROLE_IDS = new Set<string>(ROLES.map((r) => r.id))

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string')

/**
 * Comprueba que un valor leído de fuera (localStorage, red…) tiene la forma de un
 * `GameState` de la versión actual. Evita que datos corruptos o antiguos rompan la app.
 */
export function isGameState(x: unknown): x is GameState {
  if (!isObj(x)) return false
  if (x.version !== 1) return false
  if (typeof x.phase !== 'string' || !PHASES.includes(x.phase)) return false
  if (typeof x.round !== 'number' || !Number.isInteger(x.round) || x.round < 1) return false

  if (!Array.isArray(x.players) || x.players.length === 0) return false
  const ids = new Set<string>()
  for (const p of x.players) {
    if (!isObj(p)) return false
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return false
    if (typeof p.roleId !== 'string' || !ROLE_IDS.has(p.roleId)) return false
    if (typeof p.alive !== 'boolean') return false
    ids.add(p.id)
  }
  if (ids.size !== x.players.length) return false

  const r = x.rules
  if (!isObj(r)) return false
  if (typeof r.guardianCanSelfProtect !== 'boolean') return false
  if (typeof r.guardianCanRepeat !== 'boolean') return false
  if (r.doubleSave !== 'survives' && r.doubleSave !== 'dies') return false
  if (typeof r.witchCanSelfSave !== 'boolean') return false
  if (typeof r.witchBothPotionsSameNight !== 'boolean') return false

  const n = x.night
  if (!isObj(n) || !Array.isArray(n.steps) || !n.steps.every((s) => typeof s === 'string' && STEPS.includes(s))) return false
  if (typeof n.stepIndex !== 'number' || n.stepIndex < 0 || n.stepIndex >= Math.max(n.steps.length, 1)) return false
  if (!isObj(n.actions)) return false

  if (x.lovers !== null) {
    if (!isStrArr(x.lovers) || x.lovers.length !== 2 || !x.lovers.every((id) => ids.has(id))) return false
  }
  const w = x.witch
  if (!isObj(w) || typeof w.lifeUsed !== 'boolean' || typeof w.deathUsed !== 'boolean') return false
  if (x.guardianLast !== null && (typeof x.guardianLast !== 'string' || !ids.has(x.guardianLast))) return false
  if (!Array.isArray(x.lastDeaths)) return false
  if (!isStrArr(x.pendingHunters) || !x.pendingHunters.every((id) => ids.has(id))) return false
  if (x.afterHunter !== 'day' && x.afterHunter !== 'night') return false
  if (x.winner !== null && (typeof x.winner !== 'string' || !WINNERS.includes(x.winner))) return false
  if (!Array.isArray(x.log)) return false
  if ((x.phase === 'gameOver') !== (x.winner !== null)) return false
  return true
}
