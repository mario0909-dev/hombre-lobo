import { actingAs, alivePlayers, isWolf, nameOf } from './night'
import { getRole } from './roles'
import type { GameState, NightStepId, RoleId } from './types'

export interface ScriptContext {
  state: GameState
  /** Nombre de la víctima de los lobos esta noche, si la hay. */
  victimName: string | null
  /** Nombres de los amantes, si Cupido ya los ha elegido. */
  loverNames: [string, string] | null
}

interface StepDef {
  title: string
  /** Orden en la noche: de menor a mayor. */
  order: number
  /** Si este paso se juega esta noche. */
  active: (state: GameState) => boolean
  script: (ctx: ScriptContext) => string
}

const firstNight = (s: GameState) => s.round === 1
const someAlive = (s: GameState, role: RoleId) => alivePlayers(s).some((p) => p.roleId === role)
const acting = (s: GameState, role: RoleId) => actingAs(s, role).length > 0

function list(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

const roleNames = (ids: RoleId[]) => list(ids.map((id) => getRole(id).name))

export const STEPS: Record<NightStepId, StepDef> = {
  inicio: {
    title: 'Cae la noche',
    order: 0,
    active: () => true,
    script: ({ state }) =>
      state.round === 1
        ? 'El pueblo de Castronegro se va a dormir. Todos cerrad los ojos y silencio total.'
        : 'Vuelve a caer la noche sobre Castronegro. Todos cerrad los ojos.',
  },
  ladron: {
    title: 'Ladrón',
    order: 5,
    active: (s) => firstNight(s) && acting(s, 'ladron') && s.thiefCards.length === 2,
    script: ({ state }) => {
      const forced = state.thiefCards.every((r) => getRole(r).team === 'lobos')
      return `Ladrón, despierta. Estas son las dos cartas que han sobrado: ${roleNames(state.thiefCards)}. ${
        forced ? 'Como las dos son de lobo, tienes que coger una.' : 'Puedes cambiar tu carta por una de ellas.'
      } Ladrón, duérmete.`
    },
  },
  comediante: {
    title: 'Comediante',
    order: 7,
    active: (s) => acting(s, 'comediante') && s.actorCards.length > 0,
    script: ({ state }) =>
      `Comediante, despierta. Te quedan estas cartas: ${roleNames(state.actorCards)}. Si quieres, señala una: esta noche tendrás su poder. Comediante, duérmete.`,
  },
  perroLobo: {
    title: 'Perro lobo',
    order: 8,
    active: (s) => firstNight(s) && someAlive(s, 'perroLobo'),
    script: () => 'Perro lobo, despierta. Decide si quieres ser un aldeano o un hombre lobo. Perro lobo, duérmete.',
  },
  cupido: {
    title: 'Cupido',
    order: 10,
    active: (s) => firstNight(s) && acting(s, 'cupido'),
    script: () => 'Cupido, despierta. Señala a los dos jugadores que quedarán enamorados. Cupido, duérmete.',
  },
  amantes: {
    title: 'Los enamorados',
    order: 11,
    active: (s) => firstNight(s) && acting(s, 'cupido'),
    script: ({ loverNames }) => {
      const who = loverNames ? `${loverNames[0]} y ${loverNames[1]}` : 'los dos enamorados'
      return `Enamorados, despertad (${who}). Mirad quién es vuestra pareja. Enamorados, dormíos.`
    },
  },
  hermanas: {
    title: 'Las dos hermanas',
    order: 12,
    active: (s) => firstNight(s) && someAlive(s, 'hermana'),
    script: () => 'Hermanas, despertad. Miraos y reconoceos. Hermanas, dormíos.',
  },
  hermanos: {
    title: 'Los tres hermanos',
    order: 13,
    active: (s) => firstNight(s) && someAlive(s, 'hermano'),
    script: () => 'Hermanos, despertad. Miraos y reconoceos. Hermanos, dormíos.',
  },
  ninoSalvaje: {
    title: 'Niño salvaje',
    order: 14,
    active: (s) => firstNight(s) && someAlive(s, 'ninoSalvaje'),
    script: () => 'Niño salvaje, despierta. Señala al jugador que será tu modelo. Niño salvaje, duérmete.',
  },
  sectario: {
    title: 'Sectario abominable',
    order: 15,
    active: (s) => firstNight(s) && someAlive(s, 'sectario'),
    script: () =>
      'Sectario, despierta. Mira bien los dos grupos del pueblo: ganarás si mueren todos los del grupo contrario al tuyo. Sectario, duérmete.',
  },
  guardian: {
    title: 'Guardián',
    order: 20,
    active: (s) => acting(s, 'guardian'),
    script: () => 'Guardián, despierta. Elige a quién proteger esta noche. Guardián, duérmete.',
  },
  lobo: {
    title: 'Hombres lobo',
    order: 30,
    active: (s) => alivePlayers(s).some(isWolf),
    script: ({ state }) => {
      const infect =
        !state.infectUsed && someAlive(state, 'padreLobos')
          ? ' Padre de los lobos: si quieres infectar a la víctima en lugar de devorarla, hazme una señal.'
          : ''
      return `Hombres lobo, despertad. Reconoceos y elegid en silencio a vuestra víctima.${infect} Hombres lobo, dormíos.`
    },
  },
  loboFeroz: {
    title: 'Gran lobo feroz',
    order: 32,
    active: (s) => someAlive(s, 'loboFeroz') && !s.players.some((p) => !p.alive && isWolf(p)),
    script: () => 'Gran lobo feroz, despierta. Elige a una segunda víctima. Gran lobo feroz, duérmete.',
  },
  loboBlanco: {
    title: 'Lobo blanco',
    order: 34,
    active: (s) =>
      s.round % 2 === 0 &&
      someAlive(s, 'loboBlanco') &&
      alivePlayers(s).some((p) => isWolf(p) && p.roleId !== 'loboBlanco'),
    script: () => 'Lobo blanco, despierta. Si quieres, señala a un hombre lobo para devorarlo. Lobo blanco, duérmete.',
  },
  vidente: {
    title: 'Vidente',
    order: 40,
    active: (s) => acting(s, 'vidente'),
    script: () => 'Vidente, despierta. Señala a un jugador para descubrir su identidad. Vidente, duérmete.',
  },
  zorro: {
    title: 'Zorro',
    order: 45,
    active: (s) => actingAs(s, 'zorro').some((p) => p.roleId !== 'zorro' || !s.foxPowerLost),
    script: () =>
      'Zorro, despierta. Señala a un jugador: te diré si él o alguno de sus vecinos es un hombre lobo. Zorro, duérmete.',
  },
  bruja: {
    title: 'Bruja',
    order: 50,
    active: (s) => acting(s, 'bruja'),
    script: ({ victimName, state }) => {
      const victim = victimName
        ? `Esta noche la víctima de los lobos es ${victimName}.`
        : 'Esta noche los lobos no han elegido a nadie.'
      const life = state.witch.lifeUsed ? 'Ya has gastado tu poción de vida.' : 'Aún tienes tu poción de vida.'
      const death = state.witch.deathUsed ? 'Ya has gastado tu poción de muerte.' : 'Aún tienes tu poción de muerte.'
      return `Bruja, despierta. ${victim} ${life} ${death} ¿Quieres usar alguna? Bruja, duérmete.`
    },
  },
  flautista: {
    title: 'Flautista',
    order: 60,
    active: (s) => someAlive(s, 'flautista'),
    script: () => 'Flautista, despierta. Señala a dos jugadores para encantarlos. Flautista, duérmete.',
  },
  encantados: {
    title: 'Los encantados',
    order: 61,
    active: (s) => someAlive(s, 'flautista'),
    script: ({ state }) => {
      const ids = [...state.enchanted, ...(state.night.actions.flautista ?? [])]
      const names = ids.filter((id) => alivePlayers(state).some((p) => p.id === id)).map((id) => nameOf(state, id))
      const who = names.length ? ` (${list(names)})` : ''
      return `Toco en la cabeza a los nuevos encantados. Encantados, despertad${who}. Reconoceos entre vosotros. Encantados, dormíos.`
    },
  },
  cuervo: {
    title: 'Cuervo',
    order: 70,
    active: (s) => acting(s, 'cuervo'),
    script: () =>
      'Cuervo, despierta. Si quieres, señala a un jugador: mañana empezará la votación con dos votos en contra. Cuervo, duérmete.',
  },
  gitana: {
    title: 'Gitana',
    order: 75,
    active: (s) => acting(s, 'gitana'),
    script: () =>
      'Gitana, despierta. Si quieres, señala al jugador que mañana hará una pregunta a los espíritus. Gitana, duérmete.',
  },
}

/** Pasos de la noche, en orden, según quién sigue vivo y con poder. Los muertos no despiertan. */
export function buildNightSteps(state: GameState): NightStepId[] {
  return (Object.keys(STEPS) as NightStepId[])
    .filter((id) => STEPS[id].active(state))
    .sort((a, b) => STEPS[a].order - STEPS[b].order)
}

/**
 * Recalcula los pasos que quedan tras el actual. Hace falta cuando una decisión de
 * esta noche cambia quién despierta (el ladrón coge otra carta, el comediante elige una…).
 */
export function rebuildRemainingSteps(state: GameState): GameState {
  const { steps, stepIndex } = state.night
  const order = STEPS[steps[stepIndex]].order
  const rest = buildNightSteps(state).filter((id) => STEPS[id].order > order)
  return { ...state, night: { ...state.night, steps: [...steps.slice(0, stepIndex + 1), ...rest] } }
}

export const STEP_TITLES = Object.fromEntries(
  (Object.keys(STEPS) as NightStepId[]).map((id) => [id, STEPS[id].title]),
) as Record<NightStepId, string>

export function stepScript(step: NightStepId, ctx: ScriptContext): string {
  return STEPS[step].script(ctx)
}

/** Rol cuya carta se enseña en cada paso de la noche (si lo hay). */
export const STEP_ROLE: Partial<Record<NightStepId, RoleId>> = {
  ladron: 'ladron',
  comediante: 'comediante',
  perroLobo: 'perroLobo',
  cupido: 'cupido',
  hermanas: 'hermana',
  hermanos: 'hermano',
  ninoSalvaje: 'ninoSalvaje',
  sectario: 'sectario',
  guardian: 'guardian',
  lobo: 'lobo',
  loboFeroz: 'loboFeroz',
  loboBlanco: 'loboBlanco',
  vidente: 'vidente',
  zorro: 'zorro',
  bruja: 'bruja',
  flautista: 'flautista',
  encantados: 'flautista',
  cuervo: 'cuervo',
  gitana: 'gitana',
}
