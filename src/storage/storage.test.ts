import { describe, expect, it } from 'vitest'
import { aplicar } from '../game'
import { game, playNight } from '../game/testUtils'
import { clearSaved, loadSaved, MAX_UNDO, save } from './storage'
import type { StorageLike } from './storage'

function memory(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v
    },
    removeItem: (k) => {
      delete data[k]
    },
  }
}

const base = () => game(['lobo', 'aldeano', 'aldeano', 'vidente', 'aldeano'])

describe('guardado de la partida', () => {
  it('guarda y recupera la partida con su historial de deshacer', () => {
    const st = memory()
    const first = base()
    const second = aplicar(first, { type: 'SIGUIENTE_PASO' })
    expect(save({ version: 1, present: second, past: [first] }, st)).toBe(true)
    expect(loadSaved(st)).toEqual({ version: 1, present: second, past: [first] })
  })

  it('devuelve null si no hay nada guardado', () => {
    expect(loadSaved(memory())).toBeNull()
  })

  it('devuelve null con JSON corrupto', () => {
    expect(loadSaved(memory({ 'castronegro:partida': '{no es json' }))).toBeNull()
  })

  it('rechaza datos con otra versión o forma', () => {
    const s = base()
    const wrongVersion = JSON.stringify({ present: { ...s, version: 99 }, past: [] })
    expect(loadSaved(memory({ 'castronegro:partida': wrongVersion }))).toBeNull()
    const wrongRole = JSON.stringify({ present: { ...s, players: [{ ...s.players[0], roleId: 'dragon' }] }, past: [] })
    expect(loadSaved(memory({ 'castronegro:partida': wrongRole }))).toBeNull()
    expect(loadSaved(memory({ 'castronegro:partida': '123' }))).toBeNull()
    expect(loadSaved(memory({ 'castronegro:partida': 'null' }))).toBeNull()
  })

  it('descarta entradas inválidas del historial pero conserva la partida', () => {
    const s = base()
    const raw = JSON.stringify({ present: s, past: [s, { basura: true }] })
    expect(loadSaved(memory({ 'castronegro:partida': raw }))).toEqual({ version: 1, present: s, past: [s] })
  })

  it('limita el historial de deshacer', () => {
    const st = memory()
    const s = base()
    save({ version: 1, present: s, past: Array.from({ length: MAX_UNDO + 20 }, () => s) }, st)
    expect(loadSaved(st)?.past).toHaveLength(MAX_UNDO)
  })

  it('una partida a medias (con lobos, amantes y fin) se recupera igual', () => {
    const st = memory()
    const s = playNight(game(['lobo', 'aldeano', 'aldeano', 'aldeano', 'cupido']), { cupido: ['p1', 'p2'], lobo: 'p3' })
    save({ version: 1, present: s, past: [] }, st)
    expect(loadSaved(st)?.present).toEqual(s)
  })

  it('pone al día una partida guardada con la versión 1', () => {
    const s = base()
    const v1 = { ...s, version: 1, rules: { ...s.rules, sheriff: undefined } } as Record<string, unknown>
    for (const key of ['thiefCards', 'actorCards', 'elderHit', 'enchanted', 'sect', 'judge', 'sheriff']) delete v1[key]
    const loaded = loadSaved(memory({ 'castronegro:partida': JSON.stringify({ present: v1, past: [v1] }) }))
    expect(loaded?.present).toEqual(s)
    expect(loaded?.past).toEqual([s])
  })

  it('borra la partida guardada', () => {
    const st = memory()
    save({ version: 1, present: base(), past: [] }, st)
    clearSaved(st)
    expect(loadSaved(st)).toBeNull()
  })

  it('no falla si el almacenamiento lanza errores o no existe', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('lleno')
      },
      removeItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(loadSaved(broken)).toBeNull()
    expect(save({ version: 1, present: base(), past: [] }, broken)).toBe(false)
    expect(() => clearSaved(broken)).not.toThrow()
    expect(loadSaved(null)).toBeNull()
    expect(save({ version: 1, present: base(), past: [] }, null)).toBe(false)
  })
})
