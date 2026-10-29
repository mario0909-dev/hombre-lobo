import { isGameState, upgradeState } from '../game/validate'
import type { GameState } from '../game/types'

const KEY = 'castronegro:partida'
export const MAX_UNDO = 100

export interface Saved {
  version: 1
  present: GameState
  past: GameState[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** `localStorage` puede no existir o lanzar (modo privado, datos bloqueados). */
function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Lee la partida guardada. Devuelve `null` si no hay o si los datos no son válidos. */
export function loadSaved(storage: StorageLike | null = defaultStorage()): Saved | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const saved = data as { present?: unknown; past?: unknown }
    const present = upgradeState(saved.present)
    if (!isGameState(present)) return null
    const validPast = Array.isArray(saved.past) ? saved.past.map(upgradeState).filter(isGameState) : []
    return { version: 1, present, past: validPast.slice(-MAX_UNDO) }
  } catch {
    return null
  }
}

export function save(saved: Saved, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(KEY, JSON.stringify({ ...saved, past: saved.past.slice(-MAX_UNDO) }))
    return true
  } catch {
    return false
  }
}

export function clearSaved(storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.removeItem(KEY)
  } catch {
    // Sin almacenamiento: nada que borrar.
  }
}

/** Preferencias sueltas de la interfaz (tema, voz). Nunca lanza. */
export function readPref(key: string, storage: StorageLike | null = defaultStorage()): string | null {
  try {
    return storage?.getItem(`castronegro:${key}`) ?? null
  } catch {
    return null
  }
}

export function writePref(key: string, value: string, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(`castronegro:${key}`, value)
  } catch {
    // Se ignora: la preferencia simplemente no se recuerda.
  }
}
