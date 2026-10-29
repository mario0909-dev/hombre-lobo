import type { GameState, NightStepId, RoleId, Team } from './types'

export interface ScriptContext {
  state: GameState
  /** Nombre de la víctima de los lobos esta noche, si la hay. */
  victimName: string | null
  /** Nombres de los amantes, si Cupido ya los ha elegido. */
  loverNames: [string, string] | null
}

export interface RoleDef {
  id: RoleId
  name: string
  team: Team
  /** Orden en que despierta de noche; `null` = no despierta. */
  nightOrder: number | null
  firstNightOnly?: boolean
  description: string
  script?: (ctx: ScriptContext) => string
}

export const ROLES: RoleDef[] = [
  {
    id: 'aldeano',
    name: 'Aldeano',
    team: 'villa',
    nightOrder: null,
    description: 'Sin poder especial. Duerme toda la noche y vota de día.',
  },
  {
    id: 'lobo',
    name: 'Hombre lobo',
    team: 'lobos',
    nightOrder: 30,
    description: 'Cada noche los lobos eligen a una víctima.',
    script: () =>
      'Hombres lobo, despertad. Reconoceos y elegid en silencio a vuestra víctima. Hombres lobo, dormíos.',
  },
  {
    id: 'vidente',
    name: 'Vidente',
    team: 'villa',
    nightOrder: 40,
    description: 'Cada noche descubre la identidad de un jugador.',
    script: () =>
      'Vidente, despierta. Señala a un jugador para descubrir su identidad. Vidente, duérmete.',
  },
  {
    id: 'bruja',
    name: 'Bruja',
    team: 'villa',
    nightOrder: 50,
    description: 'Tiene una poción de vida y otra de muerte, de un solo uso cada una.',
    script: ({ victimName, state }) => {
      const victim = victimName
        ? `Esta noche la víctima de los lobos es ${victimName}.`
        : 'Esta noche los lobos no han elegido a nadie.'
      const life = state.witch.lifeUsed ? 'Ya has gastado tu poción de vida.' : 'Aún tienes tu poción de vida.'
      const death = state.witch.deathUsed
        ? 'Ya has gastado tu poción de muerte.'
        : 'Aún tienes tu poción de muerte.'
      return `Bruja, despierta. ${victim} ${life} ${death} ¿Quieres usar alguna? Bruja, duérmete.`
    },
  },
  {
    id: 'cazador',
    name: 'Cazador',
    team: 'villa',
    nightOrder: null,
    description: 'Si muere, por lo que sea, dispara y se lleva a otro jugador.',
  },
  {
    id: 'cupido',
    name: 'Cupido',
    team: 'villa',
    nightOrder: 10,
    firstNightOnly: true,
    description: 'La primera noche enamora a dos jugadores: si uno muere, muere el otro.',
    script: () =>
      'Cupido, despierta. Señala a los dos jugadores que quedarán enamorados. Cupido, duérmete.',
  },
  {
    id: 'guardian',
    name: 'Guardián',
    team: 'villa',
    nightOrder: 20,
    description: 'Cada noche protege a un jugador del ataque de los lobos.',
    script: () => 'Guardián, despierta. Elige a quién proteger esta noche. Guardián, duérmete.',
  },
  {
    id: 'nina',
    name: 'Niña',
    team: 'villa',
    nightOrder: null,
    description: 'No tiene turno propio; puede intentar espiar a los lobos según tu variante.',
  },
]

const BY_ID = new Map<RoleId, RoleDef>(ROLES.map((r) => [r.id, r]))

export function getRole(id: RoleId): RoleDef {
  const role = BY_ID.get(id)
  if (!role) throw new Error(`Rol desconocido: ${id}`)
  return role
}

/** Textos de los pasos que no pertenecen a un rol. */
export const STEP_TITLES: Record<NightStepId, string> = {
  inicio: 'Cae la noche',
  cupido: 'Cupido',
  amantes: 'Los enamorados',
  guardian: 'Guardián',
  lobo: 'Hombres lobo',
  vidente: 'Vidente',
  bruja: 'Bruja',
}

export function stepScript(step: NightStepId, ctx: ScriptContext): string {
  switch (step) {
    case 'inicio':
      return ctx.state.round === 1
        ? 'El pueblo de Castronegro se va a dormir. Todos cerrad los ojos y silencio total.'
        : 'Vuelve a caer la noche sobre Castronegro. Todos cerrad los ojos.'
    case 'amantes': {
      const names = ctx.loverNames
      const who = names ? `${names[0]} y ${names[1]}` : 'los dos enamorados'
      return `Enamorados, despertad (${who}). Mirad quién es vuestra pareja. Enamorados, dormíos.`
    }
    default: {
      const text = getRole(step).script?.(ctx)
      return text ?? ''
    }
  }
}
