import { describe, expect, it } from 'vitest'
import {
  createGame,
  dealRoles,
  GameRuleError,
  parseNames,
  shuffle,
  suggestRoleCounts,
  validateSetup,
} from './index'
import { game, seeded } from './testUtils'

const names = (n: number) => Array.from({ length: n }, (_, i) => `J${i + 1}`)

describe('parseNames', () => {
  it('recorta espacios, junta espacios internos y descarta líneas vacías', () => {
    expect(parseNames('  Ana \r\n\n Luis   Pérez\n   \nMarta')).toEqual(['Ana', 'Luis Pérez', 'Marta'])
  })
})

describe('suggestRoleCounts', () => {
  it('propone un reparto válido de 4 a 30 jugadores', () => {
    for (let n = 4; n <= 30; n++) {
      expect(validateSetup(names(n), suggestRoleCounts(n))).toEqual([])
    }
  })

  it('escala los lobos con el número de jugadores', () => {
    expect(suggestRoleCounts(6).lobo).toBe(1)
    expect(suggestRoleCounts(8).lobo).toBe(2)
    expect(suggestRoleCounts(12).lobo).toBe(3)
  })
})

describe('validateSetup', () => {
  it('exige un mínimo de jugadores', () => {
    expect(validateSetup(names(3), { lobo: 1 })[0]).toMatch(/al menos 4/)
  })

  it('detecta nombres repetidos sin distinguir mayúsculas', () => {
    const errors = validateSetup(['Ana', 'ana', 'Luis', 'Marta'], { lobo: 1 })
    expect(errors.join(' ')).toMatch(/repetidos/)
  })

  it('detecta más roles que jugadores', () => {
    const errors = validateSetup(names(5), { lobo: 1, vidente: 1, bruja: 1, cazador: 1, cupido: 1, guardian: 1 })
    expect(errors.join(' ')).toMatch(/más roles/)
  })

  it('exige al menos un lobo', () => {
    expect(validateSetup(names(6), { vidente: 1 }).join(' ')).toMatch(/al menos un hombre lobo/)
  })

  it('rechaza tantos lobos que ganarían de inicio', () => {
    expect(validateSetup(names(6), { lobo: 3 }).join(' ')).toMatch(/ganarían/)
  })

  it('rechaza roles únicos repetidos', () => {
    expect(validateSetup(names(8), { lobo: 1, vidente: 2 }).join(' ')).toMatch(/Vidente/)
  })
})

describe('shuffle', () => {
  it('conserva los elementos y no muta la entrada', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, seeded(1))
    expect(input).toEqual([1, 2, 3, 4, 5])
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('es uniforme: las 6 permutaciones de 3 elementos salen con frecuencia parecida', () => {
    const rng = seeded(2026)
    const freq = new Map<string, number>()
    const runs = 12000
    for (let i = 0; i < runs; i++) {
      const key = shuffle(['a', 'b', 'c'], rng).join('')
      freq.set(key, (freq.get(key) ?? 0) + 1)
    }
    expect(freq.size).toBe(6)
    for (const count of freq.values()) {
      expect(count).toBeGreaterThan((runs / 6) * 0.9)
      expect(count).toBeLessThan((runs / 6) * 1.1)
    }
  })

  it('cada posición recibe cada elemento con la misma probabilidad', () => {
    const rng = seeded(7)
    const first = { a: 0, b: 0, c: 0, d: 0 }
    const runs = 8000
    for (let i = 0; i < runs; i++) first[shuffle(['a', 'b', 'c', 'd'], rng)[0] as 'a']++
    for (const count of Object.values(first)) {
      expect(count).toBeGreaterThan((runs / 4) * 0.9)
      expect(count).toBeLessThan((runs / 4) * 1.1)
    }
  })
})

describe('dealRoles', () => {
  it('reparte exactamente las cantidades pedidas y rellena con aldeanos', () => {
    const roles = dealRoles(10, { lobo: 2, vidente: 1, bruja: 1 }, seeded(3))
    expect(roles).toHaveLength(10)
    expect(roles.filter((r) => r === 'lobo')).toHaveLength(2)
    expect(roles.filter((r) => r === 'vidente')).toHaveLength(1)
    expect(roles.filter((r) => r === 'bruja')).toHaveLength(1)
    expect(roles.filter((r) => r === 'aldeano')).toHaveLength(6)
  })

  it('permite varios lobos (el prototipo solo admitía uno)', () => {
    expect(dealRoles(12, { lobo: 3 }, seeded(4)).filter((r) => r === 'lobo')).toHaveLength(3)
  })

  it('con la misma semilla da el mismo reparto', () => {
    const a = dealRoles(8, { lobo: 2, vidente: 1 }, seeded(99))
    const b = dealRoles(8, { lobo: 2, vidente: 1 }, seeded(99))
    expect(a).toEqual(b)
  })

  it('falla si hay más roles que jugadores', () => {
    expect(() => dealRoles(3, { lobo: 2, vidente: 1, bruja: 1 }, seeded(1))).toThrow(GameRuleError)
  })
})

describe('createGame', () => {
  it('arranca en la noche 1 con ids estables', () => {
    const s = game(['lobo', 'aldeano', 'aldeano', 'vidente', 'aldeano'])
    expect(s.phase).toBe('night')
    expect(s.round).toBe(1)
    expect(s.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    expect(s.players.every((p) => p.alive)).toBe(true)
    expect(s.winner).toBeNull()
  })

  it('rechaza configuraciones inválidas', () => {
    expect(() =>
      createGame([
        { name: 'A', roleId: 'aldeano' },
        { name: 'B', roleId: 'aldeano' },
        { name: 'C', roleId: 'aldeano' },
        { name: 'D', roleId: 'aldeano' },
      ]),
    ).toThrow(GameRuleError)
  })

  it('el estado se puede serializar a JSON sin perder nada', () => {
    const s = game(['lobo', 'aldeano', 'aldeano', 'vidente', 'aldeano'])
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
