import { describe, expect, it } from 'vitest'
import { checkWinner } from './index'
import type { Player, RoleId } from './types'

function players(spec: Array<[RoleId, boolean]>): Player[] {
  return spec.map(([roleId, alive], i) => ({ id: `p${i + 1}`, name: `J${i + 1}`, roleId, alive }))
}

describe('checkWinner', () => {
  it('nadie gana si no queda nadie vivo', () => {
    expect(checkWinner(players([['lobo', false], ['aldeano', false]]), null)).toBe('nadie')
  })

  it('ganan los aldeanos si no quedan lobos', () => {
    expect(checkWinner(players([['lobo', false], ['aldeano', true], ['vidente', true]]), null)).toBe('villa')
  })

  it('ganan los lobos al igualar en número', () => {
    expect(checkWinner(players([['lobo', true], ['aldeano', true]]), null)).toBe('lobos')
  })

  it('ganan los lobos al superar en número', () => {
    expect(checkWinner(players([['lobo', true], ['lobo', true], ['aldeano', true]]), null)).toBe('lobos')
  })

  it('la partida sigue si los aldeanos son mayoría', () => {
    expect(checkWinner(players([['lobo', true], ['aldeano', true], ['aldeano', true]]), null)).toBeNull()
  })

  it('los enamorados de bandos distintos ganan si son los dos últimos', () => {
    const ps = players([['lobo', true], ['aldeano', true], ['aldeano', false]])
    expect(checkWinner(ps, ['p1', 'p2'])).toBe('amantes')
  })

  it('si los enamorados son del mismo bando gana ese bando', () => {
    const wolves = players([['lobo', true], ['lobo', true], ['aldeano', false]])
    expect(checkWinner(wolves, ['p1', 'p2'])).toBe('lobos')
    const villagers = players([['lobo', false], ['aldeano', true], ['vidente', true]])
    expect(checkWinner(villagers, ['p2', 'p3'])).toBe('villa')
  })

  it('con enamorados vivos pero más gente viva, la partida sigue', () => {
    const ps = players([['lobo', true], ['aldeano', true], ['aldeano', true], ['aldeano', true]])
    expect(checkWinner(ps, ['p1', 'p2'])).toBeNull()
  })
})
