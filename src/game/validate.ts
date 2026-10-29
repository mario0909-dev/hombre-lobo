import { ROLES } from './roles'
import { STEPS } from './steps'
import type { GameState } from './types'

const PHASES = ['night', 'dawn', 'hunter', 'day', 'gameOver']
const STEP_IDS = new Set<string>(Object.keys(STEPS))
const WINNERS = ['villa', 'lobos', 'amantes', 'angel', 'flautista', 'loboBlanco', 'sectario', 'nadie']
const ROLE_IDS = new Set<string>(ROLES.map((r) => r.id))

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string')

/**
 * Pone al día una partida guardada con una versión anterior (sin los personajes
 * de las ampliaciones). Lo que no reconoce lo devuelve tal cual.
 */
export function upgradeState(x: unknown): unknown {
  if (!isObj(x) || x.version !== 1) return x
  return {
    ...x,
    version: 2,
    rules: isObj(x.rules) ? { ...x.rules, sheriff: false } : x.rules,
    thiefCards: [],
    actorCards: [],
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
  }
}

/**
 * Comprueba que un valor leído de fuera (localStorage, red…) tiene la forma de un
 * `GameState` de la versión actual. Evita que datos corruptos o antiguos rompan la app.
 */
export function isGameState(x: unknown): x is GameState {
  if (!isObj(x)) return false
  if (x.version !== 2) return false
  if (typeof x.phase !== 'string' || !PHASES.includes(x.phase)) return false
  if (typeof x.round !== 'number' || !Number.isInteger(x.round) || x.round < 1) return false

  if (!Array.isArray(x.players) || x.players.length === 0) return false
  const ids = new Set<string>()
  for (const p of x.players) {
    if (!isObj(p)) return false
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return false
    if (typeof p.roleId !== 'string' || !ROLE_IDS.has(p.roleId)) return false
    if (typeof p.alive !== 'boolean') return false
    if (p.wolf !== undefined && p.wolf !== true) return false
    ids.add(p.id)
  }
  if (ids.size !== x.players.length) return false
  const isId = (v: unknown) => v === null || (typeof v === 'string' && ids.has(v))
  const isIdArr = (v: unknown) => isStrArr(v) && v.every((id) => ids.has(id))
  const isRoleArr = (v: unknown) => isStrArr(v) && v.every((id) => ROLE_IDS.has(id))

  const r = x.rules
  if (!isObj(r)) return false
  if (typeof r.guardianCanSelfProtect !== 'boolean') return false
  if (typeof r.guardianCanRepeat !== 'boolean') return false
  if (r.doubleSave !== 'survives' && r.doubleSave !== 'dies') return false
  if (typeof r.witchCanSelfSave !== 'boolean') return false
  if (typeof r.witchBothPotionsSameNight !== 'boolean') return false
  if (typeof r.sheriff !== 'boolean') return false

  const n = x.night
  if (!isObj(n) || !Array.isArray(n.steps) || !n.steps.every((s) => typeof s === 'string' && STEP_IDS.has(s))) return false
  if (typeof n.stepIndex !== 'number' || n.stepIndex < 0 || n.stepIndex >= Math.max(n.steps.length, 1)) return false
  if (!isObj(n.actions)) return false

  if (x.lovers !== null && !(isIdArr(x.lovers) && (x.lovers as string[]).length === 2)) return false
  const w = x.witch
  if (!isObj(w) || typeof w.lifeUsed !== 'boolean' || typeof w.deathUsed !== 'boolean') return false
  if (!isId(x.guardianLast)) return false
  if (!isRoleArr(x.thiefCards) || !isRoleArr(x.actorCards)) return false
  for (const flag of ['elderHit', 'villagePowersLost', 'idiotRevealed', 'infectUsed', 'foxPowerLost']) {
    if (typeof x[flag] !== 'boolean') return false
  }
  if (!isId(x.wildChildModel) || !isId(x.rustNext) || !isId(x.ravenMark) || !isId(x.medium) || !isId(x.sheriff)) {
    return false
  }
  if (!isIdArr(x.enchanted)) return false
  if (x.sect !== null && !isIdArr(x.sect)) return false
  const j = x.judge
  if (!isObj(j) || typeof j.used !== 'boolean' || typeof j.secondVote !== 'boolean') return false

  if (!Array.isArray(x.lastDeaths)) return false
  if (!isIdArr(x.pendingHunters)) return false
  if (x.afterHunter !== 'day' && x.afterHunter !== 'night') return false
  if (x.winner !== null && (typeof x.winner !== 'string' || !WINNERS.includes(x.winner))) return false
  if (!Array.isArray(x.log)) return false
  if ((x.phase === 'gameOver') !== (x.winner !== null)) return false
  return true
}
