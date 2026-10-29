export type RoleId =
  | 'aldeano'
  | 'lobo'
  | 'vidente'
  | 'bruja'
  | 'cazador'
  | 'cupido'
  | 'guardian'
  | 'nina'

export type Team = 'villa' | 'lobos'

export type DeathCause = 'lobos' | 'veneno' | 'votacion' | 'cazador' | 'amor' | 'narrador'

export interface Player {
  id: string
  name: string
  roleId: RoleId
  alive: boolean
  /** Presente solo si el jugador está muerto. */
  death?: { cause: DeathCause; round: number }
}

export type RoleCounts = Partial<Record<RoleId, number>>

export interface HouseRules {
  guardianCanSelfProtect: boolean
  guardianCanRepeat: boolean
  /** Qué pasa si guardián y bruja salvan a la misma víctima. */
  doubleSave: 'survives' | 'dies'
  witchCanSelfSave: boolean
  witchBothPotionsSameNight: boolean
}

/** 'inicio' y 'amantes' son pasos de guion sin rol propio. */
export type NightStepId = 'inicio' | 'cupido' | 'amantes' | 'guardian' | 'lobo' | 'vidente' | 'bruja'

export interface NightActions {
  cupido?: [string, string]
  guardian?: string | null
  /** `undefined` = aún no elegido; `null` = los lobos no matan a nadie. */
  lobo?: string | null
  vidente?: string | null
  brujaSalva?: boolean
  brujaVeneno?: string | null
}

export interface NightState {
  steps: NightStepId[]
  stepIndex: number
  actions: NightActions
}

export type Phase = 'night' | 'dawn' | 'hunter' | 'day' | 'gameOver'

export type Winner = 'villa' | 'lobos' | 'amantes' | 'nadie'

export interface Death {
  playerId: string
  cause: DeathCause
}

export interface LogEntry {
  round: number
  text: string
}

export interface GameState {
  version: 1
  phase: Phase
  /** Número de la noche actual, empezando en 1. */
  round: number
  players: Player[]
  rules: HouseRules
  night: NightState
  lovers: [string, string] | null
  witch: { lifeUsed: boolean; deathUsed: boolean }
  guardianLast: string | null
  /** Muertes de la última resolución (noche, votación o disparo), para mostrarlas. */
  lastDeaths: Death[]
  /** Cazadores muertos que aún tienen que disparar. */
  pendingHunters: string[]
  /** A dónde ir cuando terminen los disparos. */
  afterHunter: 'day' | 'night'
  winner: Winner | null
  log: LogEntry[]
}

export type Action =
  | { type: 'CUPIDO_ELIGE'; a: string; b: string }
  | { type: 'GUARDIAN_ELIGE'; target: string | null }
  | { type: 'LOBOS_ELIGEN'; target: string | null }
  | { type: 'VIDENTE_ELIGE'; target: string }
  | { type: 'BRUJA_SALVA'; save: boolean }
  | { type: 'BRUJA_ENVENENA'; target: string | null }
  | { type: 'SIGUIENTE_PASO' }
  | { type: 'CONTINUAR' }
  | { type: 'CAZADOR_DISPARA'; target: string | null }
  | { type: 'VOTAR_LINCHAMIENTO'; target: string | null }
  | { type: 'MATAR_MANUAL'; playerId: string }
  | { type: 'REVIVIR_MANUAL'; playerId: string }

/** Error de regla: la acción no es válida en el estado actual. */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GameRuleError'
  }
}
