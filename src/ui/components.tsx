import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CAUSE_TEXT, getRole, ROLES } from '../game'
import type { GameState, Player, RoleId } from '../game'
import { cardSrc } from './format'
import type { useSpeech } from './hooks'
import { useCardModal } from './useCardModal'

export type Speech = ReturnType<typeof useSpeech>

const TEAM_LABEL = { villa: 'Pueblo', lobos: 'Hombres lobo', solitario: 'Juega solo' } as const

/** Miniatura de la carta. Si se pasa `onOpen`, se puede tocar para verla en grande. */
export function CardThumb({ id, size = 'sm', onOpen }: { id: RoleId; size?: 'xs' | 'sm' | 'md'; onOpen?: (id: RoleId) => void }) {
  const img = <img className={`card-img card-${size}`} src={cardSrc(id)} alt="" loading="lazy" draggable={false} />
  if (!onOpen) return img
  return (
    <button type="button" className="card-thumb-btn" onClick={() => onOpen(id)} aria-label={`Ver la carta de ${getRole(id).name}`}>
      {img}
    </button>
  )
}

/** Carta a pantalla completa, para enseñársela a un jugador o consultarla. */
export function CardModal({ id, playerName, onClose }: { id: RoleId; playerName?: string; onClose: () => void }) {
  const role = getRole(id)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={role.name} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {playerName && <p className="muted center">Carta de <strong>{playerName}</strong></p>}
        <img className="card-img card-lg" src={cardSrc(id)} alt={role.name} draggable={false} />
        <h2 className="center">{role.name}</h2>
        <p className="center">
          <span className={`pill team-${role.team}`}>{TEAM_LABEL[role.team]}</span>
        </p>
        <p className="center">{role.description}</p>
        <button type="button" className="btn btn-primary btn-big" onClick={onClose} autoFocus>
          Cerrar
        </button>
      </div>
    </div>
  )
}

/** Todas las cartas del juego, agrupadas. */
export function CatalogScreen({ onClose }: { onClose: () => void }) {
  const { show, modal } = useCardModal()
  const groups = [
    { title: 'Juego básico', roles: ROLES.filter((r) => r.edition === 'basico') },
    { title: 'Ampliaciones', roles: ROLES.filter((r) => r.edition === 'ampliacion') },
  ]
  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className="card">
          <h2>{g.title}</h2>
          <ul className="catalog">
            {g.roles.map((r) => (
              <li key={r.id}>
                <button type="button" className="catalog-item" onClick={() => show(r.id)}>
                  <img className="card-img card-md" src={cardSrc(r.id)} alt="" loading="lazy" />
                  <span className="catalog-name">{r.name}</span>
                  <span className={`target-meta team-text-${r.team}`}>{TEAM_LABEL[r.team]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ActionBar>
        <button type="button" className="btn btn-primary btn-big" onClick={onClose}>
          Volver
        </button>
      </ActionBar>
      {modal}
    </>
  )
}

/** Tarjeta con el texto que el narrador debe leer. */
export function NarrationCard({
  title,
  text,
  badge,
  speech,
  cardId,
  children,
}: {
  title: string
  text: string
  badge?: string
  speech: Speech
  /** Carta del personaje que despierta en este paso. */
  cardId?: RoleId
  /** Datos extra para el narrador, debajo del texto. */
  children?: ReactNode
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
      <div className="narration-body">
        {cardId && <CardThumb id={cardId} size="md" />}
        <div className="stack">
          <h2>{title}</h2>
          <p className="narration-text">{text}</p>
        </div>
      </div>
      {children}
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
            {showRoles && (
              <span className="target-meta">
                {getRole(p.roleId).name}
                {p.wolf ? ' · lobo' : ''}
              </span>
            )}
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
  const { show, modal } = useCardModal()
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
              <CardThumb id={p.roleId} size="xs" onOpen={(id) => show(id, p.name)} />
              <div className="grow">
                <strong>{p.name}</strong>
                <div className="muted small">
                  {role.name}
                  {p.wolf ? ' · 🐺 ahora es lobo' : ''}
                  {state.lovers?.includes(p.id) ? ' · 💘 enamorado' : ''}
                  {state.sheriff === p.id ? ' · ⭐ alguacil' : ''}
                  {state.enchanted.includes(p.id) ? ' · 🎶 encantado' : ''}
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
      {modal}
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
