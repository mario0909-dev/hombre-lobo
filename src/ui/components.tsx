import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CAUSE_TEXT, getRole } from '../game'
import type { GameState, Player } from '../game'
import type { useSpeech } from './hooks'

export type Speech = ReturnType<typeof useSpeech>

/** Tarjeta con el texto que el narrador debe leer. */
export function NarrationCard({
  title,
  text,
  badge,
  speech,
}: {
  title: string
  text: string
  badge?: string
  speech: Speech
}) {
  const { enabled, speak } = speech
  useEffect(() => {
    if (enabled) speak(text)
  }, [enabled, speak, text])

  return (
    <section className="card narration" aria-live="polite">
      <div className="card-head">
        {badge ? <span className="pill">{badge}</span> : <span />}
        {speech.supported && (
          <button type="button" className="btn btn-ghost btn-small" onClick={() => speak(text)}>
            🔊 Leer
          </button>
        )}
      </div>
      <h2>{title}</h2>
      <p className="narration-text">{text}</p>
    </section>
  )
}

/** Cuadrícula de jugadores para señalar uno o varios. */
export function TargetPicker({
  players,
  selected,
  onPick,
  disabledReasons = {},
  showRoles = false,
}: {
  players: Player[]
  selected: Array<string | null | undefined>
  onPick: (id: string) => void
  disabledReasons?: Record<string, string>
  showRoles?: boolean
}) {
  return (
    <div className="targets" role="group">
      {players.map((p) => {
        const reason = disabledReasons[p.id]
        const isSelected = selected.includes(p.id)
        return (
          <button
            key={p.id}
            type="button"
            className={`target${isSelected ? ' selected' : ''}`}
            disabled={!!reason}
            aria-pressed={isSelected}
            onClick={() => onPick(p.id)}
          >
            <span className="target-name">{p.name}</span>
            {showRoles && <span className="target-meta">{getRole(p.roleId).name}</span>}
            {reason && <span className="target-meta">{reason}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Barra fija inferior con la acción principal (cómoda con una mano). */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="action-bar">{children}</div>
}

export function PlayersPanel({
  state,
  editable,
  onKill,
  onRevive,
  open = false,
}: {
  state: GameState
  editable: boolean
  onKill: (id: string) => void
  onRevive: (id: string) => void
  open?: boolean
}) {
  const alive = state.players.filter((p) => p.alive).length
  return (
    <details className="card panel" open={open}>
      <summary>
        Jugadores <span className="muted">· {alive} vivos de {state.players.length}</span>
      </summary>
      <ul className="players">
        {state.players.map((p) => {
          const role = getRole(p.roleId)
          return (
            <li key={p.id} className={`player${p.alive ? '' : ' dead'}`}>
              <div>
                <strong>{p.name}</strong>
                <div className="muted small">
                  {role.name}
                  {state.lovers?.includes(p.id) ? ' · 💘 enamorado' : ''}
                  {p.death ? ` · ${CAUSE_TEXT[p.death.cause]} (noche ${p.death.round})` : ''}
                </div>
              </div>
              {editable &&
                (p.alive ? (
                  <button type="button" className="btn btn-danger btn-small" onClick={() => onKill(p.id)}>
                    Matar
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => onRevive(p.id)}>
                    Revivir
                  </button>
                ))}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

export function LogPanel({ state }: { state: GameState }) {
  return (
    <details className="card panel">
      <summary>
        Registro <span className="muted">· {state.log.length} sucesos</span>
      </summary>
      <ol className="log">
        {state.log.map((entry, i) => (
          <li key={i}>
            <span className="muted small">Noche {entry.round}</span> {entry.text}
          </li>
        ))}
      </ol>
    </details>
  )
}
