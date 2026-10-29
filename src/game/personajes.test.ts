import { describe, expect, it } from 'vitest'
import {
  aplicar,
  bearGrowls,
  checkWinner,
  currentStep,
  dealCards,
  foxSmellsWolf,
  GameRuleError,
  isWolf,
  validateSetup,
  validTargets,
} from './index'
import type { Action, GameState, RoleId } from './types'
import { dead, game, playNight, run } from './testUtils'

const names = (n: number) => Array.from({ length: n }, (_, i) => `J${i + 1}`)
const VILLAGERS = (n: number): RoleId[] => Array.from({ length: n }, () => 'aldeano')
const toDay = (s: GameState) => run(s, { type: 'CONTINUAR' })
const tie: Action = { type: 'VOTAR_LINCHAMIENTO', target: null }
/** De amanecer a la noche siguiente sin muertes. */
const toNextNight = (s: GameState) => run(s, { type: 'CONTINUAR' }, tie)
const player = (s: GameState, id: string) => s.players.find((p) => p.id === id)!

describe('ladrón', () => {
  // p1 lobo · p2 ladrón · p3-p6 aldeanos
  const ROLES: RoleId[] = ['lobo', 'ladron', ...VILLAGERS(4)]

  it('despierta el primero la primera noche', () => {
    expect(game(ROLES, {}, ['vidente', 'aldeano']).night.steps.slice(0, 2)).toEqual(['inicio', 'ladron'])
  })

  it('puede cambiar su carta por una de las sobrantes', () => {
    const s = playNight(game(ROLES, {}, ['vidente', 'aldeano']), { ladron: 0 }, 'lobo')
    expect(player(s, 'p2').roleId).toBe('vidente')
    expect(s.thiefCards).toEqual(['ladron', 'aldeano'])
    expect(s.night.steps).toContain('vidente')
  })

  it('si coge a Cupido, Cupido actúa esa misma noche', () => {
    const s = playNight(game([...ROLES], {}, ['cupido', 'aldeano']), { ladron: 0 }, 'cupido')
    expect(currentStep(s)).toBe('cupido')
  })

  it('si las dos cartas son de lobo, tiene que coger una', () => {
    const s = playNight(game([...ROLES, 'aldeano', 'aldeano'], {}, ['lobo', 'lobo']), {}, 'ladron')
    expect(() => aplicar(s, { type: 'LADRON_ELIGE', card: null })).toThrow(GameRuleError)
    const t = aplicar(s, { type: 'LADRON_ELIGE', card: 1 })
    expect(isWolf(player(t, 'p2'))).toBe(true)
  })

  it('tiene que decidir antes de seguir y no puede decidir dos veces', () => {
    const s = playNight(game(ROLES, {}, ['vidente', 'aldeano']), {}, 'ladron')
    expect(() => aplicar(s, { type: 'SIGUIENTE_PASO' })).toThrow(GameRuleError)
    const t = aplicar(s, { type: 'LADRON_ELIGE', card: null })
    expect(() => aplicar(t, { type: 'LADRON_ELIGE', card: 0 })).toThrow(GameRuleError)
  })

  it('el reparto da dos cartas de más y el ladrón siempre está en la mano de un jugador', () => {
    for (let seed = 1; seed < 200; seed++) {
      let x = seed
      const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647)
      const { roles, thiefCards } = dealCards(6, { lobo: 1, ladron: 1, vidente: 1 }, rng)
      expect(roles).toHaveLength(6)
      expect(thiefCards).toHaveLength(2)
      expect(roles).toContain('ladron')
    }
  })

  it('las cartas sobrantes cuentan para los roles únicos', () => {
    expect(validateSetup(names(6), { lobo: 1, ladron: 1, vidente: 2 }).join(' ')).toMatch(/Vidente/)
  })
})

describe('comediante', () => {
  // p1 lobo · p2 comediante · p3-p6 aldeanos
  const ROLES: RoleId[] = ['lobo', 'comediante', ...VILLAGERS(4)]

  it('recibe tres cartas que no están en juego', () => {
    expect(game(ROLES).actorCards).toEqual(['vidente', 'guardian', 'zorro'])
    expect(game(['vidente', ...ROLES]).actorCards).toEqual(['guardian', 'zorro', 'cuervo'])
  })

  it('al usar la vidente, despierta como vidente y la carta se descarta', () => {
    let s = playNight(game(ROLES), { comediante: 'vidente' }, 'vidente')
    expect(currentStep(s)).toBe('vidente')
    expect(validTargets(s, 'vidente').map((p) => p.id)).not.toContain('p2')
    s = playNight(s, { vidente: 'p1' })
    expect(s.actorCards).toEqual(['guardian', 'zorro'])
  })

  it('si no usa ninguna, no hay paso extra y conserva las cartas', () => {
    const s = playNight(game(ROLES), { comediante: null })
    expect(s.actorCards).toHaveLength(3)
  })
})

describe('perro lobo', () => {
  const ROLES: RoleId[] = ['lobo', 'perroLobo', ...VILLAGERS(4)]

  it('si elige ser lobo, juega con los lobos', () => {
    const s = playNight(game(ROLES), { perroLobo: 'lobos' })
    expect(isWolf(player(s, 'p2'))).toBe(true)
  })

  it('si elige ser aldeano, sigue en el pueblo', () => {
    const s = playNight(game(ROLES), { perroLobo: 'villa' })
    expect(isWolf(player(s, 'p2'))).toBe(false)
  })

  it('solo decide la primera noche', () => {
    const s = toNextNight(playNight(game(ROLES)))
    expect(s.night.steps).not.toContain('perroLobo')
  })
})

describe('hermanas y hermanos', () => {
  it('se reconocen solo la primera noche', () => {
    const roles: RoleId[] = ['lobo', 'hermana', 'hermana', 'hermano', 'hermano', 'hermano', 'aldeano']
    const s = game(roles)
    expect(s.night.steps).toEqual(['inicio', 'hermanas', 'hermanos', 'lobo'])
    expect(toNextNight(playNight(s)).night.steps).toEqual(['inicio', 'lobo'])
  })

  it('se juegan con exactamente dos hermanas o tres hermanos', () => {
    expect(validateSetup(names(8), { lobo: 1, hermana: 1 }).join(' ')).toMatch(/exactamente 2/)
    expect(validateSetup(names(8), { lobo: 1, hermano: 2 }).join(' ')).toMatch(/exactamente 3/)
    expect(validateSetup(names(8), { lobo: 1, hermana: 2, hermano: 3 })).toEqual([])
  })
})

describe('niño salvaje', () => {
  // p1 lobo · p2 niño salvaje · p3-p7 aldeanos
  const ROLES: RoleId[] = ['lobo', 'ninoSalvaje', ...VILLAGERS(5)]

  it('se convierte en lobo cuando muere su modelo', () => {
    const s = playNight(game(ROLES), { ninoSalvaje: 'p3', lobo: 'p3' })
    expect(isWolf(player(s, 'p2'))).toBe(true)
  })

  it('sigue siendo aldeano mientras su modelo vive', () => {
    const s = playNight(game(ROLES), { ninoSalvaje: 'p3', lobo: 'p4' })
    expect(isWolf(player(s, 'p2'))).toBe(false)
  })

  it('no puede elegirse a sí mismo', () => {
    const s = playNight(game(ROLES), {}, 'ninoSalvaje')
    expect(() => aplicar(s, { type: 'NINO_SALVAJE_ELIGE', target: 'p2' })).toThrow(GameRuleError)
  })
})

describe('sectario abominable', () => {
  // p1 lobo · p2 sectario · p3-p6 aldeanos. Grupo del sectario: p2, p3, p4.
  const ROLES: RoleId[] = ['lobo', 'sectario', ...VILLAGERS(4)]

  it('guarda los grupos (él siempre en el suyo)', () => {
    const s = playNight(game(ROLES), { sectario: ['p3', 'p4'] })
    expect(s.sect).toEqual(['p2', 'p3', 'p4'])
  })

  it('gana cuando muere todo el grupo contrario', () => {
    const ps = game(ROLES).players.map((p) => ({ ...p, alive: ['p2', 'p3', 'p4'].includes(p.id) }))
    expect(checkWinner(ps, null, { sect: ['p2', 'p3', 'p4'] })).toBe('sectario')
  })

  it('no puede estar todo el pueblo en su grupo', () => {
    const s = playNight(game(ROLES), {}, 'sectario')
    expect(() => aplicar(s, { type: 'SECTARIO_GRUPO', ids: ['p1', 'p3', 'p4', 'p5', 'p6'] })).toThrow(GameRuleError)
  })
})

describe('anciano', () => {
  // p1 lobo · p2 anciano · p3 vidente · p4 cazador · p5-p8 aldeanos
  const ROLES: RoleId[] = ['lobo', 'anciano', 'vidente', 'cazador', ...VILLAGERS(4)]

  it('sobrevive al primer ataque de los lobos, no al segundo', () => {
    let s = playNight(game(ROLES), { lobo: 'p2' })
    expect(dead(s)).toEqual([])
    expect(s.elderHit).toBe(true)
    s = playNight(toNextNight(s), { lobo: 'p2' })
    expect(dead(s)).toEqual(['p2'])
  })

  it('si lo mata el pueblo, los aldeanos pierden sus poderes', () => {
    let s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p2' })
    expect(s.villagePowersLost).toBe(true)
    expect(s.night.steps).not.toContain('vidente')
    // El cazador ya no dispara.
    s = toDay(playNight(s, { lobo: 'p4' }))
    expect(s.phase).toBe('day')
  })

  it('si lo matan los lobos, el pueblo conserva sus poderes', () => {
    const s = playNight(toNextNight(playNight(game(ROLES), { lobo: 'p2' })), { lobo: 'p2' })
    expect(s.villagePowersLost).toBe(false)
  })
})

describe('chivo expiatorio', () => {
  it('muere en caso de empate', () => {
    const s = run(playNight(game(['lobo', 'chivo', ...VILLAGERS(4)])), { type: 'CONTINUAR' }, tie)
    expect(dead(s)).toEqual(['p2'])
    expect(player(s, 'p2').death?.cause).toBe('chivo')
  })
})

describe('tonto del pueblo', () => {
  const ROLES: RoleId[] = ['lobo', 'tonto', ...VILLAGERS(5)]
  const vote = (target: string): Action => ({ type: 'VOTAR_LINCHAMIENTO', target })

  it('se salva la primera vez que lo votan', () => {
    const s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, vote('p2'))
    expect(dead(s)).toEqual([])
    expect(s.idiotRevealed).toBe(true)
    expect(s.phase).toBe('night')
  })

  it('la segunda vez sí muere', () => {
    let s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, vote('p2'))
    s = run(playNight(s), { type: 'CONTINUAR' }, vote('p2'))
    expect(dead(s)).toEqual(['p2'])
  })
})

describe('caballero de la espada oxidada', () => {
  // Sentados: p1 aldeano · p2 caballero · p3 aldeano · p4 lobo · p5 lobo · p6-p9 aldeanos
  const ROLES: RoleId[] = ['aldeano', 'caballero', 'aldeano', 'lobo', 'lobo', ...VILLAGERS(4)]

  it('si lo matan los lobos, el primer lobo tras él muere la noche siguiente', () => {
    let s = playNight(game(ROLES), { lobo: 'p2' })
    expect(s.rustNext).toBe('p4')
    s = playNight(toNextNight(s))
    expect(player(s, 'p4').death?.cause).toBe('oxido')
    expect(player(s, 'p5').alive).toBe(true)
  })

  it('si muere de otra forma, no pasa nada', () => {
    const s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p2' })
    expect(s.rustNext).toBeNull()
  })
})

describe('domador de osos', () => {
  it('el oso gruñe si un vecino vivo es lobo, saltándose a los muertos', () => {
    // Sentados: p1 domador · p2 aldeano · p3 lobo · p4-p6 aldeanos
    const s = game(['domador', 'aldeano', 'lobo', ...VILLAGERS(3)])
    expect(bearGrowls(s)).toBe(false)
    const t = playNight(s, { lobo: 'p2' })
    expect(bearGrowls(t)).toBe(true)
  })

  it('también mira al otro lado de la mesa (el último jugador)', () => {
    expect(bearGrowls(game(['domador', ...VILLAGERS(4), 'lobo']))).toBe(true)
  })
})

describe('zorro', () => {
  // Sentados: p1 zorro · p2 aldeano · p3 lobo · p4-p7 aldeanos
  const ROLES: RoleId[] = ['zorro', 'aldeano', 'lobo', ...VILLAGERS(4)]

  it('huele lobo en el señalado o en sus vecinos', () => {
    const s = game(ROLES)
    expect(foxSmellsWolf(s, 'p2')).toBe(true)
    expect(foxSmellsWolf(s, 'p6')).toBe(false)
  })

  it('si no huele nada, pierde el olfato y deja de despertar', () => {
    let s = playNight(game(ROLES), { zorro: 'p6' })
    expect(s.foxPowerLost).toBe(true)
    s = toNextNight(s)
    expect(s.night.steps).not.toContain('zorro')
  })

  it('si huele lobo, conserva el olfato', () => {
    const s = playNight(game(ROLES), { zorro: 'p2' })
    expect(s.foxPowerLost).toBe(false)
  })
})

describe('juez tartamudo', () => {
  const ROLES: RoleId[] = ['lobo', 'juez', ...VILLAGERS(6)]
  const vote = (target: string): Action => ({ type: 'VOTAR_LINCHAMIENTO', target })

  it('provoca una segunda votación el mismo día, una sola vez', () => {
    let s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'JUEZ_SEGUNDA_VOTACION' }, vote('p3'))
    expect(s.phase).toBe('day')
    expect(s.round).toBe(1)
    s = aplicar(s, vote('p4'))
    expect(s.phase).toBe('night')
    expect(dead(s).sort()).toEqual(['p3', 'p4'])
    s = toDay(playNight(s))
    expect(() => aplicar(s, { type: 'JUEZ_SEGUNDA_VOTACION' })).toThrow(GameRuleError)
  })
})

describe('sirvienta abnegada', () => {
  // p1 lobo · p2 sirvienta · p3 vidente · p4-p7 aldeanos
  const ROLES: RoleId[] = ['lobo', 'sirvienta', 'vidente', ...VILLAGERS(4)]

  it('se queda con la carta del eliminado', () => {
    const s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p3', servant: true })
    expect(player(s, 'p2').roleId).toBe('vidente')
    expect(player(s, 'p3')).toMatchObject({ alive: false, roleId: 'sirvienta' })
    expect(s.night.steps).toContain('vidente')
  })

  it('si se queda con un lobo, pasa a ser lobo', () => {
    const s = run(
      playNight(game([...ROLES, 'lobo', 'aldeano'])),
      { type: 'CONTINUAR' },
      { type: 'VOTAR_LINCHAMIENTO', target: 'p1', servant: true },
    )
    expect(isWolf(player(s, 'p2'))).toBe(true)
  })
})

describe('cuervo y gitana', () => {
  const ROLES: RoleId[] = ['lobo', 'cuervo', 'gitana', ...VILLAGERS(4)]

  it('sus señales duran hasta la noche siguiente', () => {
    let s = playNight(game(ROLES), { cuervo: 'p4', gitana: 'p5' })
    expect(s.ravenMark).toBe('p4')
    expect(s.medium).toBe('p5')
    s = toNextNight(s)
    expect(s.ravenMark).toBeNull()
    expect(s.medium).toBeNull()
  })
})

describe('padre de los lobos', () => {
  // p1 padre de los lobos · p2 lobo · p3-p9 aldeanos
  const ROLES: RoleId[] = ['padreLobos', 'lobo', ...VILLAGERS(7)]

  it('infecta a la víctima en lugar de matarla, una sola vez', () => {
    let s = playNight(game(ROLES), { lobo: 'p3', infectar: true })
    expect(dead(s)).toEqual([])
    expect(isWolf(player(s, 'p3'))).toBe(true)
    expect(s.infectUsed).toBe(true)
    s = playNight(toNextNight(s), {}, 'lobo')
    s = aplicar(s, { type: 'LOBOS_ELIGEN', target: 'p4' })
    expect(() => aplicar(s, { type: 'LOBOS_INFECTAN', infect: true })).toThrow(GameRuleError)
  })

  it('si el guardián protege a la víctima, no hay infección', () => {
    const s = playNight(game([...ROLES, 'guardian']), { lobo: 'p3', infectar: true, guardian: 'p3' })
    expect(isWolf(player(s, 'p3'))).toBe(false)
    expect(s.infectUsed).toBe(false)
  })

  it('cuenta como lobo para el reparto', () => {
    expect(validateSetup(names(6), { padreLobos: 1 })).toEqual([])
  })
})

describe('gran lobo feroz', () => {
  // p1 lobo feroz · p2 lobo · p3-p10 aldeanos
  const ROLES: RoleId[] = ['loboFeroz', 'lobo', ...VILLAGERS(8)]

  it('devora a una segunda víctima', () => {
    const s = playNight(game(ROLES), { lobo: 'p3', loboFeroz: 'p4' })
    expect(dead(s).sort()).toEqual(['p3', 'p4'])
  })

  it('no puede elegir a un lobo ni a la misma víctima', () => {
    const s = playNight(game(ROLES), { lobo: 'p3' }, 'loboFeroz')
    expect(() => aplicar(s, { type: 'LOBO_FEROZ_ELIGE', target: 'p2' })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'LOBO_FEROZ_ELIGE', target: 'p3' })).toThrow(GameRuleError)
  })

  it('pierde el poder en cuanto muere un lobo', () => {
    const s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p2' })
    expect(s.night.steps).not.toContain('loboFeroz')
  })
})

describe('lobo blanco', () => {
  // p1 lobo blanco · p2 lobo · p3-p9 aldeanos
  const ROLES: RoleId[] = ['loboBlanco', 'lobo', ...VILLAGERS(7)]

  it('despierta solo las noches pares y devora a un lobo', () => {
    let s = game(ROLES)
    expect(s.night.steps).not.toContain('loboBlanco')
    s = toNextNight(playNight(s))
    expect(s.night.steps).toContain('loboBlanco')
    expect(validTargets(s, 'loboBlanco').map((p) => p.id)).toEqual(['p2'])
    s = playNight(s, { loboBlanco: 'p2' })
    expect(player(s, 'p2').death?.cause).toBe('loboBlanco')
  })

  it('gana si queda solo', () => {
    const ps = game(ROLES).players.map((p) => ({ ...p, alive: p.id === 'p1' }))
    expect(checkWinner(ps, null)).toBe('loboBlanco')
  })

  it('mientras vive, los demás lobos no ganan por igualar en número', () => {
    const ps = game(ROLES).players.map((p) => ({ ...p, alive: ['p1', 'p2', 'p3'].includes(p.id) }))
    expect(checkWinner(ps, null)).toBeNull()
  })

  it('si muere, ganan los aldeanos cuando no queda ningún lobo', () => {
    const ps = game(ROLES).players.map((p) => ({ ...p, alive: !['p1', 'p2'].includes(p.id) }))
    expect(checkWinner(ps, null)).toBe('villa')
  })
})

describe('flautista', () => {
  // p1 lobo · p2 flautista · p3-p6 aldeanos
  const ROLES: RoleId[] = ['lobo', 'flautista', ...VILLAGERS(4)]

  it('encanta a dos jugadores cada noche y los encantados despiertan', () => {
    const s = playNight(game(ROLES), { flautista: ['p3', 'p4'] })
    expect(s.enchanted).toEqual(['p3', 'p4'])
    expect(game(ROLES).night.steps.slice(-2)).toEqual(['flautista', 'encantados'])
  })

  it('no puede encantarse a sí mismo ni a un encantado', () => {
    let s = playNight(game(ROLES), { flautista: ['p3', 'p4'] })
    s = playNight(toNextNight(s), {}, 'flautista')
    expect(() => aplicar(s, { type: 'FLAUTISTA_ELIGE', targets: ['p3', 'p5'] })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'FLAUTISTA_ELIGE', targets: ['p2', 'p5'] })).toThrow(GameRuleError)
  })

  it('gana cuando todos los demás vivos están encantados', () => {
    let s = playNight(game(ROLES), { flautista: ['p3', 'p4'] })
    s = playNight(toNextNight(s), { flautista: ['p1', 'p5'], lobo: 'p6' })
    s = toDay(s)
    expect(s.winner).toBe('flautista')
  })
})

describe('ángel', () => {
  const ROLES: RoleId[] = ['lobo', 'angel', ...VILLAGERS(4)]

  it('gana si lo eliminan en la primera votación', () => {
    const s = run(playNight(game(ROLES)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p2' })
    expect(s.winner).toBe('angel')
  })

  it('gana si lo devoran la primera noche', () => {
    expect(toDay(playNight(game(ROLES), { lobo: 'p2' })).winner).toBe('angel')
  })

  it('después de la primera ronda es un aldeano más', () => {
    const s = playNight(toNextNight(playNight(game(ROLES))), { lobo: 'p2' })
    expect(toDay(s).phase).toBe('day')
  })
})

describe('alguacil', () => {
  const ROLES: RoleId[] = ['lobo', ...VILLAGERS(5)]

  it('se nombra de día y, al morir, queda pendiente el sucesor', () => {
    let s = toDay(playNight(game(ROLES, { sheriff: true })))
    s = aplicar(s, { type: 'ALGUACIL_NOMBRA', playerId: 'p3' })
    expect(s.sheriff).toBe('p3')
    s = aplicar(s, { type: 'VOTAR_LINCHAMIENTO', target: 'p3' })
    expect(s.sheriff).toBeNull()
    expect(s.log.some((e) => /sucesor/.test(e.text))).toBe(true)
  })

  it('sin la regla activada no se puede nombrar', () => {
    const s = toDay(playNight(game(ROLES)))
    expect(() => aplicar(s, { type: 'ALGUACIL_NOMBRA', playerId: 'p3' })).toThrow(GameRuleError)
  })
})
