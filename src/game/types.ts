export type RoleId =
  // Juego básico
  | 'aldeano'
  | 'lobo'
  | 'vidente'
  | 'bruja'
  | 'cazador'
  | 'cupido'
  | 'nina'
  | 'ladron'
  // Ampliaciones (Nueva Luna y Personajes)
  | 'guardian'
  | 'anciano'
  | 'chivo'
  | 'tonto'
  | 'hermana'
  | 'hermano'
  | 'aldeanoAldeano'
  | 'caballero'
  | 'domador'
  | 'zorro'
  | 'juez'
  | 'sirvienta'
  | 'comediante'
  | 'cuervo'
  | 'gitana'
  | 'ninoSalvaje'
  | 'perroLobo'
  | 'padreLobos'
  | 'loboFeroz'
  | 'loboBlanco'
  | 'flautista'
  | 'angel'
  | 'sectario'

/** Bando con el que empieza la carta. Los que juegan solos tienen su propia victoria. */
export type Team = 'villa' | 'lobos' | 'solitario'

export type DeathCause =
  | 'lobos'
  | 'loboBlanco'
  | 'veneno'
  | 'votacion'
  | 'chivo'
  | 'cazador'
  | 'amor'
  | 'oxido'
  | 'narrador'

export interface Player {
  id: string
  name: string
  roleId: RoleId
  alive: boolean
  /** Presente solo si el jugador está muerto. */
  death?: { cause: DeathCause; round: number }
  /** Se ha pasado a los lobos (infectado, niño salvaje o perro lobo que elige ser lobo). */
  wolf?: true
}

export type RoleCounts = Partial<Record<RoleId, number>>

export interface HouseRules {
  guardianCanSelfProtect: boolean
  guardianCanRepeat: boolean
  /** Qué pasa si guardián y bruja salvan a la misma víctima. */
  doubleSave: 'survives' | 'dies'
  witchCanSelfSave: boolean
  witchBothPotionsSameNight: boolean
  /** Se elige un alguacil cuyo voto vale doble y que desempata. */
  sheriff: boolean
}

/** 'inicio', 'amantes', 'encantados', 'hermanas', 'hermanos' y 'sectario' son pasos de guion. */
export type NightStepId =
  | 'inicio'
  | 'ladron'
  | 'comediante'
  | 'perroLobo'
  | 'cupido'
  | 'amantes'
  | 'hermanas'
  | 'hermanos'
  | 'ninoSalvaje'
  | 'sectario'
  | 'guardian'
  | 'lobo'
  | 'loboFeroz'
  | 'loboBlanco'
  | 'vidente'
  | 'zorro'
  | 'bruja'
  | 'flautista'
  | 'encantados'
  | 'cuervo'
  | 'gitana'

export interface NightActions {
  /** Quién era el ladrón y qué carta cogió (`null` = se queda la suya). */
  ladron?: { thief: string; took: RoleId | null }
  /** Carta que usa el comediante esta noche; `null` = ninguna. */
  comediante?: RoleId | null
  perroLobo?: 'villa' | 'lobos'
  cupido?: [string, string]
  ninoSalvaje?: string
  /** Jugadores del grupo del sectario (él incluido). */
  sectario?: string[]
  guardian?: string | null
  /** `undefined` = aún no elegido; `null` = los lobos no matan a nadie. */
  lobo?: string | null
  /** El padre de los lobos infecta a la víctima en vez de matarla. */
  infectar?: boolean
  loboFeroz?: string | null
  loboBlanco?: string | null
  vidente?: string | null
  zorro?: string | null
  brujaSalva?: boolean
  brujaVeneno?: string | null
  flautista?: string[]
  cuervo?: string | null
  gitana?: string | null
}

export interface NightState {
  steps: NightStepId[]
  stepIndex: number
  actions: NightActions
}

export type Phase = 'night' | 'dawn' | 'hunter' | 'day' | 'gameOver'

export type Winner = 'villa' | 'lobos' | 'amantes' | 'angel' | 'flautista' | 'loboBlanco' | 'sectario' | 'nadie'

export interface Death {
  playerId: string
  cause: DeathCause
}

export interface LogEntry {
  round: number
  text: string
}

export interface GameState {
  version: 2
  phase: Phase
  /** Número de la noche actual, empezando en 1. */
  round: number
  /** En el orden en que están sentados (importa para zorro, domador y caballero). */
  players: Player[]
  rules: HouseRules
  night: NightState
  lovers: [string, string] | null
  witch: { lifeUsed: boolean; deathUsed: boolean }
  guardianLast: string | null
  /** Cartas sobrantes que puede coger el ladrón la primera noche. */
  thiefCards: RoleId[]
  /** Cartas del comediante que aún no ha usado. */
  actorCards: RoleId[]
  /** El anciano ya ha sobrevivido a un ataque de los lobos. */
  elderHit: boolean
  /** El pueblo mató al anciano: los aldeanos con poder lo pierden. */
  villagePowersLost: boolean
  idiotRevealed: boolean
  infectUsed: boolean
  foxPowerLost: boolean
  wildChildModel: string | null
  enchanted: string[]
  /** Grupo del sectario (él incluido); el resto es el grupo rival. */
  sect: string[] | null
  /** Lobo que morirá la próxima noche por el óxido del caballero. */
  rustNext: string | null
  /** Señalado por el cuervo: empieza la votación con dos votos en contra. */
  ravenMark: string | null
  /** Señalado por la gitana: hace la pregunta a los espíritus. */
  medium: string | null
  judge: { used: boolean; secondVote: boolean }
  sheriff: string | null
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
  | { type: 'LADRON_ELIGE'; card: number | null }
  | { type: 'COMEDIANTE_ELIGE'; role: RoleId | null }
  | { type: 'PERRO_LOBO_ELIGE'; side: 'villa' | 'lobos' }
  | { type: 'CUPIDO_ELIGE'; a: string; b: string }
  | { type: 'NINO_SALVAJE_ELIGE'; target: string }
  | { type: 'SECTARIO_GRUPO'; ids: string[] }
  | { type: 'GUARDIAN_ELIGE'; target: string | null }
  | { type: 'LOBOS_ELIGEN'; target: string | null }
  | { type: 'LOBOS_INFECTAN'; infect: boolean }
  | { type: 'LOBO_FEROZ_ELIGE'; target: string | null }
  | { type: 'LOBO_BLANCO_ELIGE'; target: string | null }
  | { type: 'VIDENTE_ELIGE'; target: string }
  | { type: 'ZORRO_ELIGE'; target: string | null }
  | { type: 'BRUJA_SALVA'; save: boolean }
  | { type: 'BRUJA_ENVENENA'; target: string | null }
  | { type: 'FLAUTISTA_ELIGE'; targets: string[] }
  | { type: 'CUERVO_ELIGE'; target: string | null }
  | { type: 'GITANA_ELIGE'; target: string | null }
  | { type: 'SIGUIENTE_PASO' }
  | { type: 'CONTINUAR' }
  | { type: 'CAZADOR_DISPARA'; target: string | null }
  | { type: 'ALGUACIL_NOMBRA'; playerId: string }
  | { type: 'JUEZ_SEGUNDA_VOTACION' }
  /** `servant`: la sirvienta se queda con el rol del eliminado. */
  | { type: 'VOTAR_LINCHAMIENTO'; target: string | null; servant?: boolean }
  | { type: 'MATAR_MANUAL'; playerId: string }
  | { type: 'REVIVIR_MANUAL'; playerId: string }

/** Error de regla: la acción no es válida en el estado actual. */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GameRuleError'
  }
}
