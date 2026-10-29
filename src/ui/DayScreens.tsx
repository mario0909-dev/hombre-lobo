import { useState } from 'react'
import { alivePlayers, CAUSE_TEXT, getRole, nameOf, playerById } from '../game'
import type { Action, GameState, Winner } from '../game'
import { ActionBar, LogPanel, NarrationCard, PlayersPanel, TargetPicker } from './components'
import { joinNames } from './format'
import type { Speech } from './components'

type Props = { state: GameState; dispatch: (a: Action) => void; speech: Speech }

const manual = (dispatch: (a: Action) => void) => ({
  onKill: (playerId: string) => dispatch({ type: 'MATAR_MANUAL', playerId }),
  onRevive: (playerId: string) => dispatch({ type: 'REVIVIR_MANUAL', playerId }),
})

export function DawnScreen({ state, dispatch, speech }: Props) {
  const names = state.lastDeaths.map((d) => nameOf(state, d.playerId))
  const text = names.length
    ? `Amanece en Castronegro. Todos abrid los ojos. Esta noche ${names.length > 1 ? 'han muerto' : 'ha muerto'} ${joinNames(names)}.`
    : 'Amanece en Castronegro. Todos abrid los ojos. Esta noche no ha muerto nadie.'

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
                <li key={d.playerId}>
                  <strong>{p?.name}</strong> era {p ? getRole(p.roleId).name : '¿?'} · {CAUSE_TEXT[d.cause]}
                </li>
              )
            })}
          </ul>
        </section>
      )}

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

export function HunterScreen({ state, dispatch, speech }: Props) {
  const [target, setTarget] = useState<string | null>(null)
  const shooterId = state.pendingHunters[0]
  const shooter = playerById(state, shooterId)
  const options = alivePlayers(state).filter((p) => p.id !== shooterId)
  const text = `${shooter?.name ?? 'El cazador'} era el Cazador. Antes de morir, dispara contra otro jugador. ¿A quién se lleva por delante?`

  return (
    <>
      <NarrationCard title="Disparo del cazador" text={text} speech={speech} />
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
  const text =
    'Es de día. El pueblo se reúne en la plaza. Debatid quién creéis que es un hombre lobo y, cuando lo tengáis claro, votad.'

  return (
    <>
      <NarrationCard title="Debate y votación" text={text} badge={`Día ${state.round}`} speech={speech} />

      {state.lastDeaths.length > 0 && (
        <p className="hint">
          Último suceso: {joinNames(state.lastDeaths.map((d) => nameOf(state, d.playerId)))} (
          {state.lastDeaths.map((d) => CAUSE_TEXT[d.cause]).join(', ')}).
        </p>
      )}

      <section className="card">
        <h3>¿A quién elige el pueblo?</h3>
        <TargetPicker
          players={alivePlayers(state)}
          selected={[target]}
          onPick={(id) => setTarget(target === id ? null : id)}
        />
      </section>

      <PlayersPanel state={state} editable {...manual(dispatch)} />
      <LogPanel state={state} />

      <ActionBar>
        <button
          type="button"
          className="btn btn-danger btn-big"
          disabled={!target}
          onClick={() => {
            dispatch({ type: 'VOTAR_LINCHAMIENTO', target })
            setTarget(null)
          }}
        >
          {target ? `Eliminar a ${nameOf(state, target)}` : 'Elige al más votado'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            dispatch({ type: 'VOTAR_LINCHAMIENTO', target: null })
            setTarget(null)
          }}
        >
          Empate: no muere nadie
        </button>
      </ActionBar>
    </>
  )
}

const WINNER_TEXT: Record<Winner, { title: string; text: string }> = {
  villa: { title: '¡Ganan los aldeanos!', text: 'Los hombres lobo han sido descubiertos. Castronegro respira tranquilo.' },
  lobos: { title: '¡Ganan los hombres lobo!', text: 'Los lobos se han hecho con el pueblo. Castronegro cae en la oscuridad.' },
  amantes: { title: '¡Ganan los enamorados!', text: 'Contra todo pronóstico, el amor ha sobrevivido a la masacre.' },
  nadie: { title: 'Nadie gana', text: 'No queda nadie con vida en Castronegro.' },
}

export function GameOverScreen({ state, onNewGame, speech }: { state: GameState; onNewGame: () => void; speech: Speech }) {
  const result = WINNER_TEXT[state.winner ?? 'nadie']
  return (
    <>
      <NarrationCard title={result.title} text={result.text} badge={`Fin · ${state.round} noches`} speech={speech} />
      <section className="card">
        <h3>Quién era quién</h3>
        <ul className="players">
          {state.players.map((p) => (
            <li key={p.id} className={`player${p.alive ? '' : ' dead'}`}>
              <div>
                <strong>{p.name}</strong>
                <div className="muted small">
                  {getRole(p.roleId).name}
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
    </>
  )
}
