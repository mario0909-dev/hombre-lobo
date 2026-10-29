import { useCallback, useEffect, useRef, useState } from 'react'
import { aplicar, GameRuleError } from '../game'
import type { Action, GameState } from '../game'
import { clearSaved, loadSaved, MAX_UNDO, readPref, save, writePref } from '../storage/storage'
import type { Saved } from '../storage/storage'

export function useGame() {
  const [stored] = useState<Saved | null>(() => loadSaved())
  const [resumable, setResumable] = useState<Saved | null>(stored)
  const [present, setPresent] = useState<GameState | null>(null)
  const [past, setPast] = useState<GameState[]>([])
  const [error, setError] = useState<string | null>(null)

  // Guarda tras cada cambio. Mientras no haya partida en marcha no se toca lo guardado.
  useEffect(() => {
    if (present) save({ version: 1, present, past })
  }, [present, past])

  const dispatch = useCallback(
    (action: Action) => {
      if (!present) return
      try {
        const next = aplicar(present, action)
        setError(null)
        setPast((p) => [...p, present].slice(-MAX_UNDO))
        setPresent(next)
      } catch (e) {
        if (e instanceof GameRuleError) setError(e.message)
        else throw e
      }
    },
    [present],
  )

  const undo = useCallback(() => {
    if (!past.length) return
    setError(null)
    setPresent(past[past.length - 1])
    setPast(past.slice(0, -1))
  }, [past])

  const start = useCallback((state: GameState) => {
    setResumable(null)
    setError(null)
    setPast([])
    setPresent(state)
  }, [])

  const resume = useCallback(() => {
    if (!resumable) return
    setPresent(resumable.present)
    setPast(resumable.past)
    setResumable(null)
  }, [resumable])

  /** Abandona la partida (en curso o guardada) y vuelve a la configuración. */
  const quit = useCallback(() => {
    clearSaved()
    setResumable(null)
    setPresent(null)
    setPast([])
    setError(null)
  }, [])

  return { game: present, resumable, canUndo: past.length > 0, error, dispatch, undo, start, resume, quit }
}

export type Theme = 'dark' | 'light'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (readPref('theme') === 'light' ? 'light' : 'dark'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writePref('theme', theme)
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}

/** Lectura en voz alta del guion con la síntesis de voz del navegador. */
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [enabled, setEnabled] = useState(() => readPref('voz') === 'on')

  useEffect(() => {
    writePref('voz', enabled ? 'on' : 'off')
    if (!enabled && supported) window.speechSynthesis.cancel()
  }, [enabled, supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'es-ES'
      utter.rate = 0.95
      window.speechSynthesis.speak(utter)
    },
    [supported],
  )

  const toggle = useCallback(() => setEnabled((v) => !v), [])
  return { supported, enabled, toggle, speak }
}

/** Mantiene la pantalla encendida mientras `active` sea true (si el navegador lo permite). */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false

    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) void s.release()
        else sentinel.current = s
      } catch {
        // El navegador puede rechazarlo (batería baja, pestaña oculta): no es grave.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel.current?.release()
      sentinel.current = null
    }
  }, [active])
}
