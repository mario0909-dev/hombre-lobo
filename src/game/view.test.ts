import { describe, expect, it } from 'vitest'
import { vistaPara } from './index'
import type { RoleId } from './types'
import { game, playNight, run } from './testUtils'

// p1,p2 lobos · p3 vidente · p4 bruja · p5 cupido · p6-p8 aldeanos
const ROLES: RoleId[] = ['lobo', 'lobo', 'vidente', 'bruja', 'cupido', 'aldeano', 'aldeano', 'aldeano']

describe('vistaPara', () => {
  it('el narrador lo ve todo y recibe el estado completo', () => {
    const s = game(ROLES)
    const v = vistaPara(s, 'narrador')
    expect(v.full).toBe(s)
    expect(v.players.every((p) => p.roleId !== undefined)).toBe(true)
    expect(v.me).toBeUndefined()
  })

  it('un aldeano solo ve su propio rol', () => {
    const v = vistaPara(game(ROLES), 'p6')
    expect(v.full).toBeNull()
    expect(v.me).toMatchObject({ id: 'p6', roleId: 'aldeano', alive: true })
    expect(v.players.filter((p) => p.roleId !== undefined).map((p) => p.id)).toEqual(['p6'])
  })

  it('los lobos se ven entre sí pero no al resto', () => {
    const v = vistaPara(game(ROLES), 'p1')
    expect(v.players.filter((p) => p.roleId !== undefined).map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  it('el rol de los muertos se revela', () => {
    const s = playNight(game(ROLES), { cupido: ['p6', 'p7'], lobo: 'p8' })
    const v = vistaPara(s, 'p3')
    expect(v.players.find((p) => p.id === 'p8')).toMatchObject({ alive: false, roleId: 'aldeano' })
    expect(v.players.find((p) => p.id === 'p4')?.roleId).toBeUndefined()
  })

  it('un enamorado conoce a su pareja pero no su rol', () => {
    const s = playNight(game(ROLES), { cupido: ['p6', 'p4'] })
    const v = vistaPara(s, 'p6')
    expect(v.me?.partnerId).toBe('p4')
    expect(v.players.find((p) => p.id === 'p4')?.roleId).toBeUndefined()
    expect(vistaPara(s, 'p7').me?.partnerId).toBeUndefined()
  })

  it('al terminar la partida todos los roles son visibles', () => {
    const s = run(
      playNight(game(['lobo', 'aldeano', 'aldeano', 'aldeano', 'aldeano'])),
      { type: 'CONTINUAR' },
      { type: 'VOTAR_LINCHAMIENTO', target: 'p1' },
    )
    expect(s.phase).toBe('gameOver')
    expect(vistaPara(s, 'p2').players.every((p) => p.roleId !== undefined)).toBe(true)
  })

  it('un jugador desconocido da error', () => {
    expect(() => vistaPara(game(ROLES), 'p99')).toThrow()
  })

  it('la vista de un jugador no filtra el estado secreto', () => {
    const s = playNight(game(ROLES), { cupido: ['p6', 'p7'], lobo: 'p8', vidente: 'p1' })
    const json = JSON.stringify(vistaPara(s, 'p6'))
    expect(json).not.toContain('"night"')
    expect(json).not.toContain('"log"')
    expect(json).not.toContain('witch')
  })
})
