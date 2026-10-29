import { useState } from 'react'
import {
  actingAs,
  alivePlayers,
  currentStep,
  foxSmellsWolf,
  getRole,
  isWolf,
  missingChoice,
  nameOf,
  playerById,
  STEP_ROLE,
  STEP_TITLES,
  stepScript,
  validTargets,
  wolfVictim,
} from '../game'
import type { Action, GameState, NightStepId, Player, RoleId } from '../game'
import { ActionBar, CardThumb, NarrationCard, TargetPicker } from './components'
import type { Speech } from './components'
import { joinNames } from './format'

const HINTS: Partial<Record<NightStepId, string>> = {
  inicio: 'Espera a que todos tengan los ojos cerrados antes de seguir.',
  ladron: 'Enseña al ladrón las dos cartas sobrantes y marca su decisión.',
  comediante: 'Enseña al comediante sus cartas boca arriba. Si elige una, esta noche despertará con ese papel.',
  perroLobo: 'El perro lobo te indica con un gesto si quiere ser aldeano o lobo.',
  cupido: 'Cupido señala a dos jugadores en silencio. Márcalos aquí.',
  amantes: 'Toca suavemente en el hombro a los dos enamorados para que abran los ojos.',
  hermanas: 'Las hermanas se miran; luego pueden comunicarse con gestos cuando las despiertes.',
  hermanos: 'Los hermanos se miran; luego pueden comunicarse con gestos cuando los despiertes.',
  ninoSalvaje: 'El niño salvaje señala a su modelo. Si ese jugador muere, el niño se convierte en lobo.',
  sectario: 'Antes de la partida anuncia los dos grupos según algo visible (por ejemplo, a cada lado de la mesa). Marca aquí el grupo del sectario.',
  guardian: 'El guardián señala a quién protege. Márcalo aquí.',
  lobo: 'Los lobos señalan a su víctima en silencio. Márcala aquí.',
  loboFeroz: 'Solo mientras no haya muerto ningún lobo.',
  loboBlanco: 'Despierta una noche de cada dos, después de los lobos.',
  vidente: 'La vidente señala a un jugador: respóndele con un gesto (pulgar arriba = bueno).',
  zorro: 'Responde con un gesto. Si no hay ningún lobo entre los tres, el zorro pierde el olfato.',
  bruja: 'Enseña a la bruja a la víctima y pregúntale si usa alguna poción.',
  flautista: 'El flautista señala a dos jugadores que aún no estén encantados.',
  encantados: 'Toca la cabeza de los nuevos encantados; luego todos los encantados abren los ojos.',
  cuervo: 'Si señala a alguien, recuérdalo al empezar la votación.',
  gitana: 'Por la mañana, ese jugador hará una pregunta de sí o no a los muertos.',
}

/** Quién despierta en cada paso, para que el narrador lo tenga a la vista. */
function whoActs(state: GameState, step: NightStepId): Player[] {
  if (step === 'lobo') return alivePlayers(state).filter(isWolf)
  if (step === 'hermanas') return alivePlayers(state).filter((p) => p.roleId === 'hermana')
  if (step === 'hermanos') return alivePlayers(state).filter((p) => p.roleId === 'hermano')
  if (step === 'encantados') return alivePlayers(state).filter((p) => state.enchanted.includes(p.id) || state.night.actions.flautista?.includes(p.id))
  if (step === 'amantes') return state.lovers ? state.lovers.map((id) => playerById(state, id)).filter((p): p is Player => !!p) : []
  if (step === 'ladron' && state.night.actions.ladron) return [playerById(state, state.night.actions.ladron.thief)].filter((p): p is Player => !!p)
  const role = STEP_ROLE[step]
  return role ? actingAs(state, role) : []
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

  const { steps, stepIndex } = state.night
  const victim = wolfVictim(state)
  const text = stepScript(step, {
    state,
    victimName: victim?.name ?? null,
    loverNames: state.lovers ? [nameOf(state, state.lovers[0]), nameOf(state, state.lovers[1])] : null,
  })
  const who = whoActs(state, step)
  const isLast = stepIndex === steps.length - 1
  const missing = missingChoice(state)
  const props = { state, dispatch }

  return (
    <>
      <NarrationCard
        title={STEP_TITLES[step]}
        text={text}
        badge={`Paso ${stepIndex + 1} de ${steps.length} · Noche ${state.round}`}
        speech={speech}
        cardId={STEP_ROLE[step]}
      >
        {who.length > 0 && <p className="muted small">👤 {joinNames(who.map((p) => p.name))}</p>}
      </NarrationCard>
      {HINTS[step] && <p className="hint">{HINTS[step]}</p>}

      <section className="stack" key={step}>
        {step === 'ladron' && <LadronControls {...props} />}
        {step === 'comediante' && <ComedianteControls {...props} />}
        {step === 'perroLobo' && <PerroLoboControls {...props} />}
        {step === 'cupido' && <CupidoControls {...props} />}
        {step === 'ninoSalvaje' && (
          <SimplePick {...props} step="ninoSalvaje" chosen={state.night.actions.ninoSalvaje} pick={(target) => target && dispatch({ type: 'NINO_SALVAJE_ELIGE', target })} />
        )}
        {step === 'sectario' && <SectarioControls {...props} />}
        {step === 'guardian' && <GuardianControls {...props} />}
        {step === 'lobo' && <LoboControls {...props} />}
        {step === 'loboFeroz' && (
          <SimplePick {...props} step="loboFeroz" chosen={state.night.actions.loboFeroz} none="No devora a nadie más" pick={(target) => dispatch({ type: 'LOBO_FEROZ_ELIGE', target })} />
        )}
        {step === 'loboBlanco' && (
          <SimplePick {...props} step="loboBlanco" chosen={state.night.actions.loboBlanco} none="No devora a nadie" pick={(target) => dispatch({ type: 'LOBO_BLANCO_ELIGE', target })} />
        )}
        {step === 'vidente' && <VidenteControls {...props} />}
        {step === 'zorro' && <ZorroControls {...props} />}
        {step === 'bruja' && <BrujaControls {...props} />}
        {step === 'flautista' && <FlautistaControls {...props} />}
        {step === 'cuervo' && (
          <SimplePick {...props} step="cuervo" chosen={state.night.actions.cuervo} none="No señala a nadie" pick={(target) => dispatch({ type: 'CUERVO_ELIGE', target })} />
        )}
        {step === 'gitana' && (
          <SimplePick {...props} step="gitana" chosen={state.night.actions.gitana} none="Esta noche no" pick={(target) => dispatch({ type: 'GITANA_ELIGE', target })} />
        )}
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

/** Elegir a un jugador (o a nadie, si se pasa `none`). Tocar de nuevo al elegido lo desmarca. */
function SimplePick({
  state,
  step,
  chosen,
  pick,
  none,
}: Controls & { step: NightStepId; chosen: string | null | undefined; pick: (id: string | null) => void; none?: string }) {
  return (
    <div className="card">
      <TargetPicker
        players={validTargets(state, step)}
        selected={[chosen]}
        showRoles={step === 'loboBlanco'}
        onPick={(id) => pick(none && chosen === id ? null : id)}
      />
      {none && (
        <button type="button" className={`btn btn-ghost${chosen === null ? ' active' : ''}`} onClick={() => pick(null)}>
          {none}
        </button>
      )}
    </div>
  )
}

function CardChoice({ ids, chosen, onPick }: { ids: RoleId[]; chosen: RoleId | null | undefined; onPick: (id: RoleId, index: number) => void }) {
  return (
    <div className="card-choice">
      {ids.map((id, i) => (
        <button key={`${id}-${i}`} type="button" className={`card-option${chosen === id ? ' selected' : ''}`} aria-pressed={chosen === id} onClick={() => onPick(id, i)}>
          <CardThumb id={id} size="md" />
          <span>{getRole(id).name}</span>
        </button>
      ))}
    </div>
  )
}

function LadronControls({ state, dispatch }: Controls) {
  const chosen = state.night.actions.ladron
  const forced = state.thiefCards.every((r) => getRole(r).team === 'lobos')
  if (chosen) {
    return (
      <div className="card">
        <p>
          {chosen.took === null
            ? `${nameOf(state, chosen.thief)} se queda con su carta de ladrón.`
            : `${nameOf(state, chosen.thief)} ahora es ${getRole(chosen.took).name}.`}
        </p>
        <p className="muted small">Para cambiarlo, usa «Deshacer».</p>
      </div>
    )
  }
  return (
    <div className="card">
      <CardChoice ids={state.thiefCards} chosen={null} onPick={(_id, card) => dispatch({ type: 'LADRON_ELIGE', card })} />
      <button type="button" className="btn btn-ghost" disabled={forced} onClick={() => dispatch({ type: 'LADRON_ELIGE', card: null })}>
        {forced ? 'Las dos son de lobo: tiene que coger una' : 'Se queda con su carta'}
      </button>
    </div>
  )
}

function ComedianteControls({ state, dispatch }: Controls) {
  const chosen = state.night.actions.comediante
  return (
    <div className="card">
      <CardChoice ids={state.actorCards} chosen={chosen} onPick={(role) => dispatch({ type: 'COMEDIANTE_ELIGE', role: chosen === role ? null : role })} />
      <button type="button" className={`btn btn-ghost${chosen === null ? ' active' : ''}`} onClick={() => dispatch({ type: 'COMEDIANTE_ELIGE', role: null })}>
        No usa ninguna
      </button>
    </div>
  )
}

function PerroLoboControls({ state, dispatch }: Controls) {
  const side = state.night.actions.perroLobo
  return (
    <div className="card two-buttons">
      <button type="button" className={`btn btn-ghost${side === 'villa' ? ' active' : ''}`} onClick={() => dispatch({ type: 'PERRO_LOBO_ELIGE', side: 'villa' })}>
        🐕 Aldeano
      </button>
      <button type="button" className={`btn btn-ghost${side === 'lobos' ? ' active' : ''}`} onClick={() => dispatch({ type: 'PERRO_LOBO_ELIGE', side: 'lobos' })}>
        🐺 Hombre lobo
      </button>
    </div>
  )
}

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

function SectarioControls({ state, dispatch }: Controls) {
  const sectarian = alivePlayers(state).find((p) => p.roleId === 'sectario')
  const [group, setGroup] = useState<string[]>(() => state.night.actions.sectario ?? (sectarian ? [sectarian.id] : []))
  const saved = state.night.actions.sectario
  const toggle = (id: string) => {
    if (id === sectarian?.id) return
    setGroup((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]))
  }
  return (
    <div className="card">
      <p className="muted small">Grupo del sectario: {group.length} · Grupo contrario: {state.players.length - group.length}</p>
      <TargetPicker players={state.players} selected={group} onPick={toggle} />
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'SECTARIO_GRUPO', ids: group })}>
        {saved ? 'Actualizar grupo ✓' : 'Guardar grupo'}
      </button>
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
  const { lobo: chosen, infectar } = state.night.actions
  const canInfect = !state.infectUsed && alivePlayers(state).some((p) => p.roleId === 'padreLobos')
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
      {canInfect && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={!!infectar}
            disabled={!chosen}
            onChange={(e) => dispatch({ type: 'LOBOS_INFECTAN', infect: e.target.checked })}
          />
          <span>El padre de los lobos infecta a la víctima (se vuelve lobo en vez de morir)</span>
        </label>
      )}
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
          {target.wolf && <span className="muted small"> · ojo: se ha pasado a los lobos</span>}
        </p>
      )}
    </div>
  )
}

function ZorroControls({ state, dispatch }: Controls) {
  const chosen = state.night.actions.zorro
  const smells = chosen ? foxSmellsWolf(state, chosen) : null
  return (
    <div className="card">
      <TargetPicker players={validTargets(state, 'zorro')} selected={[chosen]} onPick={(id) => dispatch({ type: 'ZORRO_ELIGE', target: chosen === id ? null : id })} />
      <button type="button" className={`btn btn-ghost${chosen === null ? ' active' : ''}`} onClick={() => dispatch({ type: 'ZORRO_ELIGE', target: null })}>
        No olfatea
      </button>
      {chosen && (
        <p className="result">
          {smells ? '🐺 Huele a lobo (pulgar abajo)' : '🌿 No huele a lobo (pulgar arriba): pierde el olfato'}
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

function FlautistaControls({ state, dispatch }: Controls) {
  const options = validTargets(state, 'flautista')
  const need = Math.min(2, options.length)
  const chosen = state.night.actions.flautista
  const [picked, setPicked] = useState<string[]>(chosen ?? [])
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(-need)
    setPicked(next)
    if (next.length === need) dispatch({ type: 'FLAUTISTA_ELIGE', targets: next })
  }
  if (!need) return <p className="hint">Ya están todos encantados.</p>
  return (
    <div className="card">
      <p className="muted small">{chosen ? `Encanta a ${joinNames(chosen.map((id) => nameOf(state, id)))}.` : `Elige ${need === 2 ? 'a dos jugadores' : 'a un jugador'}.`}</p>
      <TargetPicker players={options} selected={picked} onPick={toggle} />
    </div>
  )
}
