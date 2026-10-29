import type { RoleId, Team } from './types'

export interface RoleDef {
  id: RoleId
  name: string
  team: Team
  edition: 'basico' | 'ampliacion'
  description: string
  /** Máximo de cartas iguales; `null` = sin límite (lobos y aldeanos). */
  max: number | null
  /** Si existe, solo se puede jugar con exactamente este número de cartas (hermanas, hermanos). */
  exactly?: number
  /** Aldeano con poder: lo pierde si el pueblo mata al anciano. */
  villagePower?: boolean
}

export const ROLES: RoleDef[] = [
  // — Juego básico —
  {
    id: 'aldeano',
    name: 'Aldeano',
    team: 'villa',
    edition: 'basico',
    max: null,
    description: 'Sin poder especial. Duerme toda la noche y vota de día.',
  },
  {
    id: 'lobo',
    name: 'Hombre lobo',
    team: 'lobos',
    edition: 'basico',
    max: null,
    description: 'Cada noche los lobos eligen a una víctima.',
  },
  {
    id: 'vidente',
    name: 'Vidente',
    team: 'villa',
    edition: 'basico',
    max: 1,
    villagePower: true,
    description: 'Cada noche descubre la identidad de un jugador.',
  },
  {
    id: 'bruja',
    name: 'Bruja',
    team: 'villa',
    edition: 'basico',
    max: 1,
    villagePower: true,
    description: 'Tiene una poción de vida y otra de muerte, de un solo uso cada una.',
  },
  {
    id: 'cazador',
    name: 'Cazador',
    team: 'villa',
    edition: 'basico',
    max: 1,
    villagePower: true,
    description: 'Si muere, por lo que sea, dispara y se lleva a otro jugador.',
  },
  {
    id: 'cupido',
    name: 'Cupido',
    team: 'villa',
    edition: 'basico',
    max: 1,
    description: 'La primera noche enamora a dos jugadores: si uno muere, muere el otro.',
  },
  {
    id: 'nina',
    name: 'Niña',
    team: 'villa',
    edition: 'basico',
    max: 1,
    villagePower: true,
    description: 'No tiene turno propio; puede intentar espiar a los lobos según tu variante.',
  },
  {
    id: 'ladron',
    name: 'Ladrón',
    team: 'villa',
    edition: 'basico',
    max: 1,
    description:
      'Se reparten dos cartas de más. La primera noche puede cambiar la suya por una de ellas; si las dos son de lobo, debe coger una.',
  },

  // — Ampliaciones —
  {
    id: 'guardian',
    name: 'Guardián',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Cada noche protege a un jugador del ataque de los lobos.',
  },
  {
    id: 'anciano',
    name: 'Anciano',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description:
      'Sobrevive al primer ataque de los lobos. Si lo mata el pueblo (votación, cazador o bruja), los aldeanos pierden sus poderes.',
  },
  {
    id: 'chivo',
    name: 'Chivo expiatorio',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'Si la votación acaba en empate, muere él en lugar de nadie.',
  },
  {
    id: 'tonto',
    name: 'Tonto del pueblo',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'La primera vez que el pueblo lo elimina se descubre y se salva, pero ya no puede votar.',
  },
  {
    id: 'hermana',
    name: 'Hermana',
    team: 'villa',
    edition: 'ampliacion',
    max: 2,
    exactly: 2,
    description: 'Las dos hermanas se reconocen la primera noche y pueden ponerse de acuerdo con gestos.',
  },
  {
    id: 'hermano',
    name: 'Hermano',
    team: 'villa',
    edition: 'ampliacion',
    max: 3,
    exactly: 3,
    description: 'Los tres hermanos se reconocen la primera noche y pueden ponerse de acuerdo con gestos.',
  },
  {
    id: 'aldeanoAldeano',
    name: 'Aldeano-aldeano',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'Aldeano por las dos caras de la carta: todos saben que es inocente.',
  },
  {
    id: 'caballero',
    name: 'Caballero de la espada oxidada',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Si lo matan los lobos, el primer lobo que se siente después de él muere de tétanos la noche siguiente.',
  },
  {
    id: 'domador',
    name: 'Domador de osos',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Cada mañana el oso gruñe si alguno de sus dos vecinos vivos es un lobo.',
  },
  {
    id: 'zorro',
    name: 'Zorro',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description:
      'Cada noche olfatea a un jugador y a sus dos vecinos. Si ninguno es lobo, pierde el olfato para siempre.',
  },
  {
    id: 'juez',
    name: 'Juez tartamudo',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Una vez por partida puede hacer una señal para que haya una segunda votación ese mismo día.',
  },
  {
    id: 'sirvienta',
    name: 'Sirvienta abnegada',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'Cuando el pueblo elimina a alguien, puede revelarse y quedarse con su carta.',
  },
  {
    id: 'comediante',
    name: 'Comediante',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Tiene tres cartas de personaje boca arriba. Cada noche puede usar una (y se descarta).',
  },
  {
    id: 'cuervo',
    name: 'Cuervo',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Cada noche puede señalar a un jugador, que empezará la votación con dos votos en contra.',
  },
  {
    id: 'gitana',
    name: 'Gitana',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    villagePower: true,
    description: 'Cada noche puede elegir a un jugador que por la mañana hará una pregunta a los espíritus (los muertos).',
  },
  {
    id: 'ninoSalvaje',
    name: 'Niño salvaje',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'La primera noche elige un modelo. Si su modelo muere, se convierte en hombre lobo.',
  },
  {
    id: 'perroLobo',
    name: 'Perro lobo',
    team: 'villa',
    edition: 'ampliacion',
    max: 1,
    description: 'La primera noche decide si es un aldeano o un hombre lobo.',
  },
  {
    id: 'padreLobos',
    name: 'Padre de los lobos',
    team: 'lobos',
    edition: 'ampliacion',
    max: 1,
    description: 'Hombre lobo. Una vez por partida puede infectar a la víctima, que se convierte en lobo en secreto.',
  },
  {
    id: 'loboFeroz',
    name: 'Gran lobo feroz',
    team: 'lobos',
    edition: 'ampliacion',
    max: 1,
    description: 'Hombre lobo. Mientras no haya muerto ningún lobo, cada noche devora a una segunda víctima.',
  },
  {
    id: 'loboBlanco',
    name: 'Lobo blanco',
    team: 'solitario',
    edition: 'ampliacion',
    max: 1,
    description: 'Caza con los lobos, pero una noche de cada dos puede matar a uno de ellos. Gana si queda solo.',
  },
  {
    id: 'flautista',
    name: 'Flautista',
    team: 'solitario',
    edition: 'ampliacion',
    max: 1,
    description: 'Cada noche encanta a dos jugadores. Gana si todos los demás vivos están encantados.',
  },
  {
    id: 'angel',
    name: 'Ángel',
    team: 'solitario',
    edition: 'ampliacion',
    max: 1,
    description: 'Gana él solo si muere en la primera noche o en la primera votación. Si no, es un aldeano más.',
  },
  {
    id: 'sectario',
    name: 'Sectario abominable',
    team: 'solitario',
    edition: 'ampliacion',
    max: 1,
    description: 'El pueblo se divide en dos grupos. Gana si mueren todos los del grupo contrario al suyo.',
  },
]

const BY_ID = new Map<RoleId, RoleDef>(ROLES.map((r) => [r.id, r]))

export function getRole(id: RoleId): RoleDef {
  const role = BY_ID.get(id)
  if (!role) throw new Error(`Rol desconocido: ${id}`)
  return role
}

/** Cartas que el comediante puede tener (se eligen entre las que no están en juego). */
export const ACTOR_ROLES: RoleId[] = ['vidente', 'guardian', 'zorro', 'cuervo', 'gitana']
