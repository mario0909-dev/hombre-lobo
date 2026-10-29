import { useState } from 'react'
import {
  alivePlayers,
  currentStep,
  getRole,
  nameOf,
  playerById,
  STEP_TITLES,
  stepScript,
  validTargets,
  wolfVictim,
} from '../game'
import type { Action, GameState, NightStepId } from '../game'
import { ActionBar, NarrationCard, TargetPicker } from './components'
import type { Speech } from './components'

const HINTS: Partial<Record<NightStepId, string>> = {
  inicio: 'Espera a que todos tengan los ojos cerrados antes de seguir.',
  cupido: 'Cupido señala a dos jugadores en silencio. Márcalos aquí.',
  amantes: 'Toca suavemente en el hombro a los dos enamorados para que abran los ojos.',
  guardian: 'El guardián señala a quién protege. Márcalo aquí.',
  lobo: 'Los lobos señalan a su víctima en silencio. Márcala aquí.',
  vidente: 'La vidente señala a un jugador: respóndele con un gesto (pulgar arriba = bueno).',
  bruja: 'Enseña a la bruja a la víctima y pregúntale si usa alguna poción.',
}

export function NightScreen({
  state,
  dispatch,
  speech,
}: {
  state: GameState
  dispatch: (a: Action) => void
  speech: Speech
}) {
  const step = currentStep(state)
  if (!step) return null

  const { steps, stepIndex, actions } = state.night
  const victim = wolfVictim(state)
  const text = stepScript(step, {
    state,
    victimName: victim?.name ?? null,
    loverNames: state.lovers ? [nameOf(state, state.lovers[0]), nameOf(state, state.lovers[1])] : null,
  })

  const isLast = stepIndex === steps.length - 1
  const missing =
    step === 'cupido' && !actions.cupido
      ? 'Elige a los dos enamorados para continuar.'
      : step === 'lobo' && actions.lobo === undefined
        ? 'Marca la víctima de los lobos (o "Sin víctima") para continuar.'
        : null

  return (
    <>
      <NarrationCard
        title={STEP_TITLES[step]}
        text={text}
        badge={`Paso ${stepIndex + 1} de ${steps.length} · Noche ${state.round}`}
        speech={speech}
      />
      {HINTS[step] && <p className="hint">{HINTS[step]}</p>}

      <section className="stack">
        {step === 'cupido' && <CupidoControls state={state} dispatch={dispatch} />}
        {step === 'guardian' && <GuardianControls state={state} dispatch={dispatch} />}
        {step === 'lobo' && <LoboControls state={state} dispatch={dispatch} />}
        {step === 'vidente' && <VidenteControls state={state} dispatch={dispatch} />}
        {step === 'bruja' && <BrujaControls state={state} dispatch={dispatch} />}
      </section>

      <ActionBar>
        {missing && <p className="hint center">{missing}</p>}
        <button
          type="button"
          className="btn btn-primary btn-big"
          disabled={!!missing}
          onClick={() => dispatch({ type: 'SIGUIENTE_PASO' })}
        >
          {isLast ? 'Amanece 🌅' : 'Siguiente'}
        </button>
      </ActionBar>
    </>
  )
}

type Controls = { state: GameState; dispatch: (a: Action) => void }

function CupidoControls({ state, dispatch }: Controls) {
  const [first, setFirst] = useState<string | null>(null)
  const chosen = state.night.actions.cupido
  const players = validTargets(state, 'cupido')

  if (chosen) {
    return (
      <div className="card">
        <p>
          💘 Enamorados: <strong>{nameOf(state, chosen[0])}</strong> y <strong>{nameOf(state, chosen[1])}</strong>
        </p>
        <p className="muted small">Para cambiar la pareja, usa «Deshacer».</p>
      </div>
    )
  }

  return (
    <div className="card">
      <p className="muted small">{first ? `Primero: ${nameOf(state, first)}. Elige al segundo.` : 'Elige al primer enamorado.'}</p>
      <TargetPicker
        players={players}
        selected={[first]}
        onPick={(id) => {
          if (!first) setFirst(id)
          else if (first === id) setFirst(null)
          else {
            dispatch({ type: 'CUPIDO_ELIGE', a: first, b: id })
            setFirst(null)
          }
        }}
      />
    </div>
  )
}

function GuardianControls({ state, dispatch }: Controls) {
  const alive = alivePlayers(state)
  const allowed = new Set(validTargets(state, 'guardian').map((p) => p.id))
  const reasons: Record<string, string> = {}
  for (const p of alive) {
    if (!allowed.has(p.id)) reasons[p.id] = p.id === state.guardianLast ? 'Ya protegido ayer' : 'No puede protegerse'
  }
  const chosen = state.night.actions.guardian
  return (
    <div className="card">
      <TargetPicker
        players={alive}
        selected={[chosen]}
        disabledReasons={reasons}
        onPick={(id) => dispatch({ type: 'GUARDIAN_ELIGE', target: id })}
      />
      <button type="button" className={`btn btn-ghost${chosen === null ? ' active' : ''}`} onClick={() => dispatch({ type: 'GUARDIAN_ELIGE', target: null })}>
        No protege a nadie
      </button>
    </div>
  )
}

function LoboControls({ state, dispatch }: Controls) {
  const chosen = state.night.actions.lobo
  return (
    <div className="card">
      <TargetPicker
        players={alivePlayers(state)}
        selected={[chosen]}
        showRoles
        onPick={(id) => dispatch({ type: 'LOBOS_ELIGEN', target: id })}
      />
      <button type="button" className={`btn btn-ghost${chosen === null ? ' active' : ''}`} onClick={() => dispatch({ type: 'LOBOS_ELIGEN', target: null })}>
        Sin víctima
      </button>
    </div>
  )
}

function VidenteControls({ state, dispatch }: Controls) {
  const chosen = state.night.actions.vidente
  const target = chosen ? playerById(state, chosen) : undefined
  return (
    <div className="card">
      <TargetPicker
        players={validTargets(state, 'vidente')}
        selected={[chosen]}
        onPick={(id) => dispatch({ type: 'VIDENTE_ELIGE', target: id })}
      />
      {target && (
        <p className="result">
          {target.name} es <strong>{getRole(target.roleId).name}</strong>
          {getRole(target.roleId).team === 'lobos' ? ' 🐺 (pulgar abajo)' : ' (pulgar arriba)'}
        </p>
      )}
    </div>
  )
}

function BrujaControls({ state, dispatch }: Controls) {
  const actions = state.night.actions
  const rules = state.rules
  const victim = wolfVictim(state)
  const lifeLeft = !state.witch.lifeUsed
  const deathLeft = !state.witch.deathUsed
  const witchIsVictim = victim?.roleId === 'bruja'

  let saveBlocked: string | null = null
  if (!lifeLeft) saveBlocked = 'Ya gastó la poción de vida'
  else if (!victim) saveBlocked = 'No hay víctima'
  else if (witchIsVictim && !rules.witchCanSelfSave) saveBlocked = 'No puede salvarse a sí misma'
  else if (actions.brujaVeneno && !rules.witchBothPotionsSameNight) saveBlocked = 'Ya va a envenenar esta noche'

  const poisonTargets = validTargets(state, 'bruja')
  const poisonReasons: Record<string, string> = {}
  if (!deathLeft) for (const p of poisonTargets) poisonReasons[p.id] = 'Sin poción'
  else if (actions.brujaSalva && !rules.witchBothPotionsSameNight) {
    for (const p of poisonTargets) poisonReasons[p.id] = 'Ya salva esta noche'
  }

  return (
    <>
      <div className="card">
        <h3>🧪 Poción de vida {lifeLeft ? '' : '(gastada)'}</h3>
        <button
          type="button"
          className={`btn btn-ghost${actions.brujaSalva ? ' active' : ''}`}
          disabled={!!saveBlocked && !actions.brujaSalva}
          onClick={() => dispatch({ type: 'BRUJA_SALVA', save: !actions.brujaSalva })}
        >
          {actions.brujaSalva ? `Salva a ${victim?.name ?? ''} ✓` : victim ? `Salvar a ${victim.name}` : 'Salvar'}
        </button>
        {saveBlocked && !actions.brujaSalva && <p className="muted small">{saveBlocked}</p>}
      </div>
      <div className="card">
        <h3>☠️ Poción de muerte {deathLeft ? '' : '(gastada)'}</h3>
        <TargetPicker
          players={poisonTargets}
          selected={[actions.brujaVeneno]}
          disabledReasons={poisonReasons}
          onPick={(id) => dispatch({ type: 'BRUJA_ENVENENA', target: actions.brujaVeneno === id ? null : id })}
        />
        {actions.brujaVeneno && <p className="result">Envenena a <strong>{nameOf(state, actions.brujaVeneno)}</strong></p>}
      </div>
    </>
  )
}
