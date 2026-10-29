import { describe, expect, it } from 'vitest'
import { aplicar, currentStep, GameRuleError } from './index'
import type { GameState, RoleId } from './types'
import { dead, game, playNight, run } from './testUtils'

// p1,p2 lobos · p3 vidente · p4 bruja · p5 guardián · p6 cupido · p7 cazador · p8-p10 aldeanos
const G10: RoleId[] = ['lobo', 'lobo', 'vidente', 'bruja', 'guardian', 'cupido', 'cazador', 'aldeano', 'aldeano', 'aldeano']
const PAIR: [string, string] = ['p8', 'p9']

/** Noche 1 completa con la pareja de Cupido ya elegida. */
const night1 = (s: GameState, plan: Parameters<typeof playNight>[1] = {}) =>
  playNight(s, { cupido: PAIR, ...plan })

/** De amanecer a la noche siguiente sin más muertes (empate en la votación). */
const toNextNight = (s: GameState) => run(s, { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: null })

describe('pasos de la noche', () => {
  it('siguen el orden Cupido → enamorados → guardián → lobos → vidente → bruja', () => {
    expect(game(G10).night.steps).toEqual(['inicio', 'cupido', 'amantes', 'guardian', 'lobo', 'vidente', 'bruja'])
  })

  it('Cupido solo actúa la primera noche', () => {
    const s = toNextNight(night1(game(G10)))
    expect(s.round).toBe(2)
    expect(s.night.steps).toEqual(['inicio', 'guardian', 'lobo', 'vidente', 'bruja'])
  })

  it('los roles muertos no despiertan', () => {
    const s = toNextNight(night1(game(G10), { lobo: 'p3' }))
    expect(s.players[2].alive).toBe(false)
    expect(s.night.steps).not.toContain('vidente')
  })

  it('solo despierta a los roles que están en la partida', () => {
    const s = game(['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano'])
    expect(s.night.steps).toEqual(['inicio', 'lobo'])
  })
})

describe('muertes de la noche', () => {
  it('los lobos matan a su víctima', () => {
    const s = night1(game(G10), { lobo: 'p10' })
    expect(s.phase).toBe('dawn')
    expect(dead(s)).toEqual(['p10'])
    expect(s.lastDeaths).toEqual([{ playerId: 'p10', cause: 'lobos' }])
    expect(s.players[9].death).toEqual({ cause: 'lobos', round: 1 })
  })

  it('si los lobos no eligen a nadie, no muere nadie', () => {
    const s = night1(game(G10), { lobo: null })
    expect(dead(s)).toEqual([])
    expect(s.log.at(-1)?.text).toMatch(/Nadie muere/)
  })

  it('el guardián protege a la víctima', () => {
    const s = night1(game(G10), { lobo: 'p10', guardian: 'p10' })
    expect(dead(s)).toEqual([])
  })

  it('la protección no cubre al que no es la víctima', () => {
    const s = night1(game(G10), { lobo: 'p10', guardian: 'p9' })
    expect(dead(s)).toEqual(['p10'])
  })

  it('la poción de vida de la bruja salva y se gasta', () => {
    const s = night1(game(G10), { lobo: 'p10', brujaSalva: true })
    expect(dead(s)).toEqual([])
    expect(s.witch).toEqual({ lifeUsed: true, deathUsed: false })
  })

  it('la bruja no puede usar la poción de vida dos veces', () => {
    const s = toNextNight(night1(game(G10), { lobo: 'p10', brujaSalva: true }))
    expect(() => playNight(s, { lobo: 'p9', brujaSalva: true })).toThrow(GameRuleError)
  })

  it('la poción de muerte mata aunque el guardián proteja', () => {
    const s = night1(game(G10), { lobo: null, guardian: 'p10', brujaVeneno: 'p10' })
    expect(s.lastDeaths).toEqual([{ playerId: 'p10', cause: 'veneno' }])
    expect(s.witch.deathUsed).toBe(true)
  })

  it('lobos y veneno pueden matar a dos personas a la vez', () => {
    const s = night1(game(G10), { lobo: 'p10', brujaVeneno: 'p3' })
    expect(dead(s).sort()).toEqual(['p10', 'p3'])
  })

  it('envenenar a la víctima de los lobos cuenta como una sola muerte', () => {
    const s = night1(game(G10), { lobo: 'p10', brujaVeneno: 'p10' })
    expect(s.lastDeaths).toEqual([{ playerId: 'p10', cause: 'lobos' }])
  })

  it('guardián y bruja sobre la misma víctima: sobrevive por defecto', () => {
    const s = night1(game(G10), { lobo: 'p10', guardian: 'p10', brujaSalva: true })
    expect(dead(s)).toEqual([])
    expect(s.witch.lifeUsed).toBe(true)
  })

  it('guardián y bruja sobre la misma víctima: muere con la regla "dies"', () => {
    const s = night1(game(G10, { doubleSave: 'dies' }), { lobo: 'p10', guardian: 'p10', brujaSalva: true })
    expect(dead(s)).toEqual(['p10'])
  })
})

describe('reglas de la bruja', () => {
  it('no puede salvar si los lobos no han elegido víctima', () => {
    const s = playNight(game(G10), { cupido: PAIR, lobo: null }, 'bruja')
    expect(() => aplicar(s, { type: 'BRUJA_SALVA', save: true })).toThrow(GameRuleError)
  })

  it('no puede salvarse a sí misma si la regla lo prohíbe', () => {
    const s = playNight(game(G10, { witchCanSelfSave: false }), { cupido: PAIR, lobo: 'p4' }, 'bruja')
    expect(() => aplicar(s, { type: 'BRUJA_SALVA', save: true })).toThrow(GameRuleError)
  })

  it('puede salvarse a sí misma por defecto', () => {
    const s = night1(game(G10), { lobo: 'p4', brujaSalva: true })
    expect(dead(s)).toEqual([])
  })

  it('no puede usar las dos pociones la misma noche si la regla lo prohíbe', () => {
    const base = playNight(game(G10, { witchBothPotionsSameNight: false }), { cupido: PAIR, lobo: 'p10' }, 'bruja')
    expect(() => run(base, { type: 'BRUJA_SALVA', save: true }, { type: 'BRUJA_ENVENENA', target: 'p9' })).toThrow(GameRuleError)
    expect(() => run(base, { type: 'BRUJA_ENVENENA', target: 'p9' }, { type: 'BRUJA_SALVA', save: true })).toThrow(GameRuleError)
  })

  it('no puede envenenarse a sí misma', () => {
    const s = playNight(game(G10), { cupido: PAIR, lobo: 'p10' }, 'bruja')
    expect(() => aplicar(s, { type: 'BRUJA_ENVENENA', target: 'p4' })).toThrow(GameRuleError)
  })

  it('puede cambiar de opinión antes de pasar de turno', () => {
    const s = playNight(game(G10), { cupido: PAIR, lobo: 'p10' }, 'bruja')
    const t = run(s, { type: 'BRUJA_SALVA', save: true }, { type: 'BRUJA_SALVA', save: false }, { type: 'SIGUIENTE_PASO' })
    expect(dead(t)).toEqual(['p10'])
    expect(t.witch.lifeUsed).toBe(false)
  })
})

describe('reglas del guardián', () => {
  it('no puede repetir protección dos noches seguidas por defecto', () => {
    const s = toNextNight(night1(game(G10), { guardian: 'p10' }))
    const atGuardian = playNight(s, {}, 'guardian')
    expect(() => aplicar(atGuardian, { type: 'GUARDIAN_ELIGE', target: 'p10' })).toThrow(GameRuleError)
    expect(() => aplicar(atGuardian, { type: 'GUARDIAN_ELIGE', target: 'p9' })).not.toThrow()
  })

  it('puede repetir si la regla lo permite', () => {
    const s = toNextNight(night1(game(G10, { guardianCanRepeat: true }), { guardian: 'p10' }))
    const atGuardian = playNight(s, {}, 'guardian')
    expect(() => aplicar(atGuardian, { type: 'GUARDIAN_ELIGE', target: 'p10' })).not.toThrow()
  })

  it('no puede protegerse a sí mismo si la regla lo prohíbe', () => {
    const s = playNight(game(G10, { guardianCanSelfProtect: false }), { cupido: PAIR }, 'guardian')
    expect(() => aplicar(s, { type: 'GUARDIAN_ELIGE', target: 'p5' })).toThrow(GameRuleError)
  })

  it('puede protegerse a sí mismo por defecto', () => {
    const s = night1(game(G10), { lobo: 'p5', guardian: 'p5' })
    expect(dead(s)).toEqual([])
  })
})

describe('validaciones de las acciones', () => {
  it('Cupido debe elegir antes de pasar de turno', () => {
    const s = playNight(game(G10), {}, 'cupido')
    expect(() => aplicar(s, { type: 'SIGUIENTE_PASO' })).toThrow(GameRuleError)
  })

  it('Cupido no puede elegir dos veces al mismo jugador', () => {
    const s = playNight(game(G10), {}, 'cupido')
    expect(() => aplicar(s, { type: 'CUPIDO_ELIGE', a: 'p8', b: 'p8' })).toThrow(GameRuleError)
  })

  it('al elegir pareja se guardan los amantes', () => {
    const s = night1(game(G10))
    expect(s.lovers).toEqual(PAIR)
  })

  it('los lobos deben elegir (aunque sea a nadie) antes de pasar', () => {
    const s = playNight(game(G10), { cupido: PAIR }, 'lobo')
    expect(() => aplicar(s, { type: 'SIGUIENTE_PASO' })).toThrow(GameRuleError)
    expect(() => run(s, { type: 'LOBOS_ELIGEN', target: null }, { type: 'SIGUIENTE_PASO' })).not.toThrow()
  })

  it('no se puede señalar a un jugador muerto', () => {
    const s = toNextNight(night1(game(G10), { lobo: 'p10' }))
    const atWolves = playNight(s, {}, 'lobo')
    expect(() => aplicar(atWolves, { type: 'LOBOS_ELIGEN', target: 'p10' })).toThrow(GameRuleError)
  })

  it('la vidente no puede mirarse a sí misma', () => {
    const s = playNight(game(G10), { cupido: PAIR }, 'vidente')
    expect(() => aplicar(s, { type: 'VIDENTE_ELIGE', target: 'p3' })).toThrow(GameRuleError)
  })

  it('rechaza acciones fuera de turno o de fase', () => {
    const s = game(G10)
    expect(() => aplicar(s, { type: 'CONTINUAR' })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'LOBOS_ELIGEN', target: 'p10' })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'VOTAR_LINCHAMIENTO', target: 'p10' })).toThrow(GameRuleError)
  })

  it('no muta el estado de entrada', () => {
    const s = game(G10)
    const before = JSON.stringify(s)
    night1(s, { lobo: 'p10', guardian: 'p9', vidente: 'p1', brujaVeneno: 'p8' })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('el estado sigue siendo serializable a mitad de partida', () => {
    const s = night1(game(G10), { lobo: 'p7', vidente: 'p1' })
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it('el paso actual avanza de uno en uno', () => {
    let s = game(G10)
    expect(currentStep(s)).toBe('inicio')
    s = aplicar(s, { type: 'SIGUIENTE_PASO' })
    expect(currentStep(s)).toBe('cupido')
  })
})

describe('votación', () => {
  it('el linchado muere y empieza la noche siguiente', () => {
    const s = run(night1(game(G10)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p10' })
    expect(dead(s)).toEqual(['p10'])
    expect(s.players[9].death).toEqual({ cause: 'votacion', round: 1 })
    expect(s.phase).toBe('night')
    expect(s.round).toBe(2)
  })

  it('un empate no mata a nadie', () => {
    const s = toNextNight(night1(game(G10)))
    expect(dead(s)).toEqual([])
    expect(s.round).toBe(2)
    expect(s.lastDeaths).toEqual([])
  })

  it('no se puede votar a un muerto', () => {
    const s = run(night1(game(G10), { lobo: 'p10' }), { type: 'CONTINUAR' })
    expect(() => aplicar(s, { type: 'VOTAR_LINCHAMIENTO', target: 'p10' })).toThrow(GameRuleError)
  })
})

describe('amantes', () => {
  it('si muere un amante, muere el otro', () => {
    const s = night1(game(G10), { lobo: 'p8' })
    expect(dead(s).sort()).toEqual(['p8', 'p9'])
    expect(s.lastDeaths).toEqual([
      { playerId: 'p8', cause: 'lobos' },
      { playerId: 'p9', cause: 'amor' },
    ])
  })

  it('también funciona con la votación', () => {
    const s = run(night1(game(G10)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p9' })
    expect(dead(s).sort()).toEqual(['p8', 'p9'])
  })

  it('el guardián protege a un amante y ninguno muere', () => {
    const s = night1(game(G10), { lobo: 'p8', guardian: 'p8' })
    expect(dead(s)).toEqual([])
  })
})

describe('cazador', () => {
  it('muerto de noche, dispara por la mañana', () => {
    let s = night1(game(G10), { lobo: 'p7' })
    expect(s.phase).toBe('dawn')
    s = aplicar(s, { type: 'CONTINUAR' })
    expect(s.phase).toBe('hunter')
    expect(s.pendingHunters).toEqual(['p7'])
    s = aplicar(s, { type: 'CAZADOR_DISPARA', target: 'p10' })
    expect(s.phase).toBe('day')
    expect(dead(s).sort()).toEqual(['p10', 'p7'])
    expect(s.lastDeaths).toEqual([{ playerId: 'p10', cause: 'cazador' }])
  })

  it('linchado, dispara y luego empieza la noche', () => {
    let s = run(night1(game(G10)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p7' })
    expect(s.phase).toBe('hunter')
    s = aplicar(s, { type: 'CAZADOR_DISPARA', target: 'p10' })
    expect(s.phase).toBe('night')
    expect(s.round).toBe(2)
  })

  it('envenenado, también dispara', () => {
    const s = run(night1(game(G10), { brujaVeneno: 'p7' }), { type: 'CONTINUAR' })
    expect(s.phase).toBe('hunter')
  })

  it('puede decidir no disparar', () => {
    const s = run(night1(game(G10), { lobo: 'p7' }), { type: 'CONTINUAR' }, { type: 'CAZADOR_DISPARA', target: null })
    expect(s.phase).toBe('day')
    expect(dead(s)).toEqual(['p7'])
  })

  it('si dispara a un amante, muere su pareja', () => {
    const s = run(night1(game(G10), { lobo: 'p7' }), { type: 'CONTINUAR' }, { type: 'CAZADOR_DISPARA', target: 'p8' })
    expect(dead(s).sort()).toEqual(['p7', 'p8', 'p9'])
  })

  it('si el cazador es amante y muere su pareja, también dispara', () => {
    const base = game(G10)
    const s = playNight(base, { cupido: ['p7', 'p8'], lobo: 'p8' })
    expect(dead(s).sort()).toEqual(['p7', 'p8'])
    expect(s.pendingHunters).toEqual(['p7'])
    expect(aplicar(s, { type: 'CONTINUAR' }).phase).toBe('hunter')
  })

  it('no puede dispararse a sí mismo ni a un muerto', () => {
    const s = run(night1(game(G10), { lobo: 'p7', brujaVeneno: 'p10' }), { type: 'CONTINUAR' })
    expect(() => aplicar(s, { type: 'CAZADOR_DISPARA', target: 'p7' })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'CAZADOR_DISPARA', target: 'p10' })).toThrow(GameRuleError)
  })

  it('no se puede disparar fuera de la fase del cazador', () => {
    expect(() => aplicar(night1(game(G10)), { type: 'CAZADOR_DISPARA', target: 'p10' })).toThrow(GameRuleError)
  })
})

describe('victoria', () => {
  const G5: RoleId[] = ['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']

  it('ganan los aldeanos al linchar al último lobo', () => {
    const s = run(playNight(game(G5)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p1' })
    expect(s.phase).toBe('gameOver')
    expect(s.winner).toBe('villa')
  })

  it('ganan los lobos cuando igualan al resto', () => {
    const s = run(playNight(game(['lobo', 'lobo', 'aldeano', 'aldeano', 'aldeano']), { lobo: 'p3' }), { type: 'CONTINUAR' })
    expect(s.phase).toBe('gameOver')
    expect(s.winner).toBe('lobos')
  })

  it('ganan los enamorados si son los dos últimos y de bandos distintos', () => {
    const roles: RoleId[] = ['lobo', 'aldeano', 'aldeano', 'aldeano', 'cupido']
    let s = playNight(game(roles), { cupido: ['p1', 'p2'], lobo: 'p3' })
    s = run(s, { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p4' })
    expect(s.phase).toBe('night')
    s = run(playNight(s, { lobo: 'p5' }), { type: 'CONTINUAR' })
    expect(s.phase).toBe('gameOver')
    expect(s.winner).toBe('amantes')
  })

  it('la partida terminada no admite más acciones', () => {
    const s = run(playNight(game(G5)), { type: 'CONTINUAR' }, { type: 'VOTAR_LINCHAMIENTO', target: 'p1' })
    expect(() => aplicar(s, { type: 'CONTINUAR' })).toThrow(GameRuleError)
    expect(() => aplicar(s, { type: 'MATAR_MANUAL', playerId: 'p2' })).toThrow(GameRuleError)
  })

  it('el cazador dispara antes de comprobar la victoria', () => {
    // 6 jugadores: lobo, cazador y 4 aldeanos. El cazador muere y se lleva al último lobo.
    const s = run(
      playNight(game(['lobo', 'cazador', 'aldeano', 'aldeano', 'aldeano', 'aldeano']), { lobo: 'p2' }),
      { type: 'CONTINUAR' },
    )
    expect(s.phase).toBe('hunter')
    const end = aplicar(s, { type: 'CAZADOR_DISPARA', target: 'p1' })
    expect(end.phase).toBe('gameOver')
    expect(end.winner).toBe('villa')
  })
})

describe('acciones manuales del narrador', () => {
  const G5: RoleId[] = ['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano']
  const toDay = (roles: RoleId[]) => run(playNight(game(roles), { cupido: PAIR }), { type: 'CONTINUAR' })

  it('mata a un jugador de día', () => {
    const s = aplicar(toDay(G10), { type: 'MATAR_MANUAL', playerId: 'p10' })
    expect(s.players[9].alive).toBe(false)
    expect(s.players[9].death?.cause).toBe('narrador')
  })

  it('no se puede de noche', () => {
    expect(() => aplicar(game(G10), { type: 'MATAR_MANUAL', playerId: 'p10' })).toThrow(GameRuleError)
  })

  it('si el muerto es cazador, dispara', () => {
    let s = aplicar(night1(game(G10)), { type: 'CONTINUAR' })
    s = aplicar(s, { type: 'MATAR_MANUAL', playerId: 'p7' })
    expect(s.phase).toBe('hunter')
    s = aplicar(s, { type: 'CAZADOR_DISPARA', target: null })
    expect(s.phase).toBe('day')
  })

  it('si la muerte decide la partida, termina', () => {
    const s = aplicar(toDay(G5), { type: 'MATAR_MANUAL', playerId: 'p1' })
    expect(s.phase).toBe('gameOver')
    expect(s.winner).toBe('villa')
  })

  it('revive a un jugador', () => {
    let s = aplicar(toDay(G10), { type: 'MATAR_MANUAL', playerId: 'p10' })
    s = aplicar(s, { type: 'REVIVIR_MANUAL', playerId: 'p10' })
    expect(s.players[9]).toEqual({ id: 'p10', name: 'J10', roleId: 'aldeano', alive: true })
    expect(() => aplicar(s, { type: 'REVIVIR_MANUAL', playerId: 'p10' })).toThrow(GameRuleError)
  })
})
