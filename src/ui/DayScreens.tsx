import { useState } from 'react'
import { alivePlayers, bearGrowls, CAUSE_TEXT, getRole, hasPower, nameOf, playerById } from '../game'
import type { Action, GameState, Winner } from '../game'
import { ActionBar, CardThumb, LogPanel, NarrationCard, PlayersPanel, TargetPicker } from './components'
import { useCardModal } from './useCardModal'
import { joinNames } from './format'
import type { Speech } from './components'

type Props = { state: GameState; dispatch: (a: Action) => void; speech: Speech }

const manual = (dispatch: (a: Action) => void) => ({
  onKill: (playerId: string) => dispatch({ type: 'MATAR_MANUAL', playerId }),
  onRevive: (playerId: string) => dispatch({ type: 'REVIVIR_MANUAL', playerId }),
})

const aliveWith = (state: GameState, roleId: Parameters<typeof getRole>[0]) =>
  alivePlayers(state).find((p) => p.roleId === roleId)

export function DawnScreen({ state, dispatch, speech }: Props) {
  const names = state.lastDeaths.map((d) => nameOf(state, d.playerId))
  const growl = bearGrowls(state)
  const parts = [
    'Amanece en Castronegro. Todos abrid los ojos.',
    names.length
      ? `Esta noche ${names.length > 1 ? 'han muerto' : 'ha muerto'} ${joinNames(names)}.`
      : 'Esta noche no ha muerto nadie.',
  ]
  if (aliveWith(state, 'domador')) parts.push(growl ? 'El oso del domador gruñe: ¡Grrr!' : 'El oso del domador duerme tranquilo.')
  if (state.medium) parts.push(`${nameOf(state, state.medium)} puede hacer una pregunta a los espíritus.`)
  const text = parts.join(' ')

  return (
    <>
      <NarrationCard title="Amanece en Castronegro" text={text} badge={`Noche ${state.round}`} speech={speech} />

      {state.lastDeaths.length > 0 && (
        <section className="card">
          <h3>Solo para el narrador</h3>
          <ul className="plain">
            {state.lastDeaths.map((d) => {
              const p = playerById(state, d.playerId)
              return (
                <li key={d.playerId} className="with-card">
                  {p && <CardThumb id={p.roleId} size="xs" />}
                  <span>
                    <strong>{p?.name}</strong> era {p ? getRole(p.roleId).name : '¿?'} · {CAUSE_TEXT[d.cause]}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <SheriffCard state={state} dispatch={dispatch} />
      <PlayersPanel state={state} editable {...manual(dispatch)} />
      <LogPanel state={state} />

      <ActionBar>
        <button type="button" className="btn btn-primary btn-big" onClick={() => dispatch({ type: 'CONTINUAR' })}>
          {state.pendingHunters.length ? 'El cazador dispara 🏹' : 'Empieza el debate'}
        </button>
      </ActionBar>
    </>
  )
}

/** Elección (o sucesión) del alguacil, si se juega con él. */
function SheriffCard({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const [target, setTarget] = useState<string | null>(null)
  if (!state.rules.sheriff) return null
  if (state.sheriff) {
    return (
      <p className="hint">
        ⭐ Alguacil: <strong>{nameOf(state, state.sheriff)}</strong>. Su voto vale doble y desempata.
      </p>
    )
  }
  return (
    <section className="card">
      <h3>⭐ Alguacil</h3>
      <p className="muted small">
        El pueblo elige a su alguacil; si el anterior ha muerto, es él quien nombra a su sucesor. Su voto vale doble.
      </p>
      <TargetPicker players={alivePlayers(state)} selected={[target]} onPick={(id) => setTarget(target === id ? null : id)} />
      <button
        type="button"
        className="btn btn-primary"
        disabled={!target}
        onClick={() => {
          if (target) dispatch({ type: 'ALGUACIL_NOMBRA', playerId: target })
          setTarget(null)
        }}
      >
        {target ? `Nombrar a ${nameOf(state, target)}` : 'Elige al alguacil'}
      </button>
    </section>
  )
}

export function HunterScreen({ state, dispatch, speech }: Props) {
  const [target, setTarget] = useState<string | null>(null)
  const shooterId = state.pendingHunters[0]
  const shooter = playerById(state, shooterId)
  const options = alivePlayers(state).filter((p) => p.id !== shooterId)
  const text = `${shooter?.name ?? 'El cazador'} era el Cazador. Antes de morir, dispara contra otro jugador. ¿A quién se lleva por delante?`

  return (
    <>
      <NarrationCard title="Disparo del cazador" text={text} speech={speech} cardId="cazador" />
      <section className="card">
        <TargetPicker players={options} selected={[target]} onPick={(id) => setTarget(target === id ? null : id)} showRoles />
      </section>
      <ActionBar>
        <button
          type="button"
          className="btn btn-danger btn-big"
          disabled={!target}
          onClick={() => {
            dispatch({ type: 'CAZADOR_DISPARA', target })
            setTarget(null)
          }}
        >
          {target ? `Dispara a ${nameOf(state, target)}` : 'Elige a quién dispara'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            dispatch({ type: 'CAZADOR_DISPARA', target: null })
            setTarget(null)
          }}
        >
          No dispara a nadie
        </button>
      </ActionBar>
    </>
  )
}

export function DayScreen({ state, dispatch, speech }: Props) {
  const [target, setTarget] = useState<string | null>(null)
  const [servant, setServant] = useState(false)
  const text =
    'Es de día. El pueblo se reúne en la plaza. Debatid quién creéis que es un hombre lobo y, cuando lo tengáis claro, votad.'

  const goat = aliveWith(state, 'chivo')
  const maid = aliveWith(state, 'sirvienta')
  const judge = aliveWith(state, 'juez')
  const idiot = state.idiotRevealed ? state.players.find((p) => p.roleId === 'tonto' && p.alive) : undefined
  const canServe = !!maid && !!target && target !== maid.id && !state.lovers?.includes(maid.id)

  const vote = (t: string | null) => {
    dispatch({ type: 'VOTAR_LINCHAMIENTO', target: t, ...(t && servant && canServe ? { servant: true } : {}) })
    setTarget(null)
    setServant(false)
  }

  return (
    <>
      <NarrationCard title="Debate y votación" text={text} badge={`Día ${state.round}`} speech={speech} />

      {state.lastDeaths.length > 0 && (
        <p className="hint">
          Último suceso: {joinNames(state.lastDeaths.map((d) => nameOf(state, d.playerId)))} (
          {state.lastDeaths.map((d) => CAUSE_TEXT[d.cause]).join(', ')}).
        </p>
      )}

      <SheriffCard state={state} dispatch={dispatch} />
      {state.ravenMark && playerById(state, state.ravenMark)?.alive && (
        <p className="hint">🐦‍⬛ El cuervo ha señalado a <strong>{nameOf(state, state.ravenMark)}</strong>: empieza con dos votos en contra.</p>
      )}
      {idiot && <p className="hint">🃏 {idiot.name} es el tonto del pueblo: ya no puede votar.</p>}
      {state.judge.secondVote && <p className="hint">⚖️ El juez ha pedido una segunda votación tras esta.</p>}

      <section className="card">
        <h3>¿A quién elige el pueblo?</h3>
        <TargetPicker
          players={alivePlayers(state)}
          selected={[target]}
          onPick={(id) => setTarget(target === id ? null : id)}
        />
        {maid && (
          <label className="toggle">
            <input type="checkbox" checked={servant && canServe} disabled={!canServe} onChange={(e) => setServant(e.target.checked)} />
            <span>
              La sirvienta ({maid.name}) se revela y se queda con la carta{target && canServe ? ` de ${nameOf(state, target)}` : ''}
            </span>
          </label>
        )}
      </section>

      {judge && hasPower(state, judge) && !state.judge.used && (
        <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'JUEZ_SEGUNDA_VOTACION' })}>
          ⚖️ El juez tartamudo pide una segunda votación
        </button>
      )}

      <PlayersPanel state={state} editable {...manual(dispatch)} />
      <LogPanel state={state} />

      <ActionBar>
        <button type="button" className="btn btn-danger btn-big" disabled={!target} onClick={() => vote(target)}>
          {target ? `Eliminar a ${nameOf(state, target)}` : 'Elige al más votado'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => vote(null)}>
          {goat ? `Empate: muere el chivo expiatorio (${goat.name})` : 'Empate: no muere nadie'}
        </button>
      </ActionBar>
    </>
  )
}

const WINNER_TEXT: Record<Winner, { title: string; text: string }> = {
  villa: { title: '¡Ganan los aldeanos!', text: 'Los hombres lobo han sido descubiertos. Castronegro respira tranquilo.' },
  lobos: { title: '¡Ganan los hombres lobo!', text: 'Los lobos se han hecho con el pueblo. Castronegro cae en la oscuridad.' },
  amantes: { title: '¡Ganan los enamorados!', text: 'Contra todo pronóstico, el amor ha sobrevivido a la masacre.' },
  angel: { title: '¡Gana el ángel!', text: 'El pueblo lo ha enviado al cielo demasiado pronto: justo lo que quería.' },
  flautista: { title: '¡Gana el flautista!', text: 'Todo Castronegro baila al son de su flauta.' },
  loboBlanco: { title: '¡Gana el lobo blanco!', text: 'Ha devorado a todos, lobos incluidos. Solo queda él bajo la luna.' },
  sectario: { title: '¡Gana el sectario abominable!', text: 'El grupo rival ha desaparecido: la secta se queda con el pueblo.' },
  nadie: { title: 'Nadie gana', text: 'No queda nadie con vida en Castronegro.' },
}

export function GameOverScreen({ state, onNewGame, speech }: { state: GameState; onNewGame: () => void; speech: Speech }) {
  const result = WINNER_TEXT[state.winner ?? 'nadie']
  const { show, modal } = useCardModal()
  return (
    <>
      <NarrationCard title={result.title} text={result.text} badge={`Fin · ${state.round} noches`} speech={speech} />
      <section className="card">
        <h3>Quién era quién</h3>
        <ul className="players">
          {state.players.map((p) => (
            <li key={p.id} className={`player${p.alive ? '' : ' dead'}`}>
              <CardThumb id={p.roleId} size="xs" onOpen={(id) => show(id, p.name)} />
              <div className="grow">
                <strong>{p.name}</strong>
                <div className="muted small">
                  {getRole(p.roleId).name}
                  {p.wolf ? ' · 🐺' : ''}
                  {state.lovers?.includes(p.id) ? ' · 💘' : ''}
                </div>
              </div>
              <span className="muted small">{p.death ? `${CAUSE_TEXT[p.death.cause]} (noche ${p.death.round})` : 'Sobrevivió'}</span>
            </li>
          ))}
        </ul>
      </section>
      <LogPanel state={state} />
      <ActionBar>
        <button type="button" className="btn btn-primary btn-big" onClick={onNewGame}>
          Nueva partida
        </button>
      </ActionBar>
      {modal}
    </>
  )
}
