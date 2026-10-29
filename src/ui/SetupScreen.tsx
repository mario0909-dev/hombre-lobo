import { useMemo, useState } from 'react'
import {
  cardTotal,
  countRoles,
  createGame,
  dealCards,
  DEFAULT_RULES,
  getRole,
  MIN_PLAYERS,
  parseNames,
  pickActorCards,
  ROLES,
  specialRoleTotal,
  suggestRoleCounts,
  validateSetup,
} from '../game'
import type { Assignment, GameState, HouseRules, RoleCounts, RoleDef, RoleId } from '../game'
import { ActionBar, CardThumb } from './components'
import { useCardModal } from './useCardModal'

const DEMO = 'Ana\nLuis\nMarta\nPablo\nSergio\nClara\nIván\nLucía\nDiego\nElena'

interface Dealt {
  forNames: string
  assignments: Assignment[]
  thiefCards: RoleId[]
}

export function SetupScreen({ onStart }: { onStart: (state: GameState) => void }) {
  const [namesText, setNamesText] = useState('')
  const [userCounts, setUserCounts] = useState<RoleCounts | null>(null)
  const [rules, setRules] = useState<HouseRules>(DEFAULT_RULES)
  const [dealt, setDealt] = useState<Dealt | null>(null)
  const [showExpansions, setShowExpansions] = useState(false)
  const { show, modal } = useCardModal()

  const names = useMemo(() => parseNames(namesText), [namesText])
  const n = names.length
  const counts = userCounts ?? suggestRoleCounts(n)
  const villagers = Math.max(0, cardTotal(n, counts) - specialRoleTotal(counts))
  const configErrors = validateSetup(names, counts)

  // El reparto solo vale mientras la lista de jugadores sea la misma con la que se hizo.
  const current = dealt && dealt.forNames === names.join('\n') ? dealt : null
  const assignments = current?.assignments ?? null
  const hasThief = !!assignments?.some((a) => a.roleId === 'ladron')
  const thiefCards = hasThief ? (current?.thiefCards.length === 2 ? current.thiefCards : (['aldeano', 'aldeano'] as RoleId[])) : []
  const dealtErrors = assignments ? validateSetup(names, countRoles(assignments, thiefCards)) : []
  const actorCards =
    assignments?.some((a) => a.roleId === 'comediante') ? pickActorCards([...assignments.map((a) => a.roleId), ...thiefCards]) : []

  const setCount = (id: RoleId, value: number) => {
    setUserCounts({ ...counts, [id]: Math.max(0, value) })
    setDealt(null)
  }

  const deal = () => {
    const { roles, thiefCards: extra } = dealCards(n, counts, Math.random)
    setDealt({ forNames: names.join('\n'), assignments: names.map((name, i) => ({ name, roleId: roles[i] })), thiefCards: extra })
  }

  const changeRole = (index: number, roleId: RoleId) => {
    if (!current || !assignments) return
    const next = assignments.map((a, i) => (i === index ? { ...a, roleId } : a))
    setDealt({ ...current, assignments: next })
  }

  const setRule = <K extends keyof HouseRules>(key: K, value: HouseRules[K]) =>
    setRules((r) => ({ ...r, [key]: value }))

  const maxWolves = Math.max(1, Math.floor((n - 1) / 2))
  const canStart = assignments !== null && dealtErrors.length === 0

  const roleRow = (r: RoleDef) => {
    const value = counts[r.id] ?? 0
    const step = r.exactly ?? 1
    const max = r.max ?? (r.id === 'lobo' ? maxWolves : n)
    return (
      <li key={r.id} className="role-row">
        <CardThumb id={r.id} size="sm" onOpen={show} />
        <div className="grow">
          <strong>{r.name}</strong>
          <div className="muted small">{r.description}</div>
        </div>
        <div className="stepper">
          <button type="button" className="btn btn-ghost btn-small" aria-label={`Menos ${r.name}`} disabled={value <= 0} onClick={() => setCount(r.id, value - step)}>
            −
          </button>
          <span className="stepper-value" aria-live="polite">{value}</span>
          <button type="button" className="btn btn-ghost btn-small" aria-label={`Más ${r.name}`} disabled={value + step > max} onClick={() => setCount(r.id, value + step)}>
            +
          </button>
        </div>
      </li>
    )
  }

  const basic = ROLES.filter((r) => r.edition === 'basico' && r.id !== 'aldeano')
  const expansion = ROLES.filter((r) => r.edition === 'ampliacion')
  const expansionCount = expansion.reduce((sum, r) => sum + (counts[r.id] ?? 0), 0)

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>1 · Jugadores</h2>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setNamesText(DEMO)
              setUserCounts(null)
              setDealt(null)
            }}
          >
            Cargar demo
          </button>
        </div>
        <label className="field">
          <span className="muted small">
            Un nombre por línea (mínimo {MIN_PLAYERS}), en el orden en que estáis sentados: importa para el zorro, el domador y el caballero.
          </span>
          <textarea
            className="textarea"
            rows={6}
            value={namesText}
            onChange={(e) => setNamesText(e.target.value)}
            placeholder={'Ana\nLuis\nMarta\nPablo'}
          />
        </label>
        <p className="muted small">{n} jugadores</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>2 · Personajes</h2>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => {
              setUserCounts(null)
              setDealt(null)
            }}
          >
            Reparto recomendado
          </button>
        </div>
        <h3>Juego básico</h3>
        <ul className="role-list">
          {basic.map(roleRow)}
          <li className="role-row">
            <CardThumb id="aldeano" size="sm" onOpen={show} />
            <div className="grow">
              <strong>Aldeanos</strong>
              <div className="muted small">Se añaden solos hasta completar las cartas.</div>
            </div>
            <span className="stepper-value">{villagers}</span>
          </li>
        </ul>
        <details className="panel" open={showExpansions} onToggle={(e) => setShowExpansions(e.currentTarget.open)}>
          <summary>
            Ampliaciones <span className="muted">· {expansionCount ? `${expansionCount} en juego` : `${expansion.length} personajes`}</span>
          </summary>
          <ul className="role-list">{expansion.map(roleRow)}</ul>
        </details>
        {(counts.ladron ?? 0) > 0 && <p className="hint">Con el ladrón se reparten dos cartas de más (las que podrá coger).</p>}
        {n > 0 && configErrors.length > 0 && (
          <ul className="errors" role="alert">
            {configErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>

      <details className="card panel">
        <summary>Reglas de la casa</summary>
        <div className="rules">
          <Toggle label="Jugar con alguacil (su voto vale doble y desempata)" checked={rules.sheriff} onChange={(v) => setRule('sheriff', v)} />
          <Toggle label="El guardián puede protegerse a sí mismo" checked={rules.guardianCanSelfProtect} onChange={(v) => setRule('guardianCanSelfProtect', v)} />
          <Toggle label="El guardián puede repetir protección dos noches seguidas" checked={rules.guardianCanRepeat} onChange={(v) => setRule('guardianCanRepeat', v)} />
          <Toggle label="La bruja puede salvarse a sí misma" checked={rules.witchCanSelfSave} onChange={(v) => setRule('witchCanSelfSave', v)} />
          <Toggle label="La bruja puede usar las dos pociones la misma noche" checked={rules.witchBothPotionsSameNight} onChange={(v) => setRule('witchBothPotionsSameNight', v)} />
          <Toggle
            label="Si guardián y bruja salvan a la misma víctima, muere"
            checked={rules.doubleSave === 'dies'}
            onChange={(v) => setRule('doubleSave', v ? 'dies' : 'survives')}
          />
        </div>
      </details>

      <section className="card">
        <div className="card-head">
          <h2>3 · Repartir</h2>
          <button type="button" className="btn btn-primary btn-small" disabled={configErrors.length > 0} onClick={deal}>
            {assignments ? 'Barajar de nuevo' : 'Repartir al azar'}
          </button>
        </div>
        {!assignments && <p className="muted">Reparte los roles al azar. Después podrás cambiar a mano cualquiera.</p>}
        {assignments && (
          <>
            <p className="muted small">
              Solo lo ves tú, el narrador. Toca la carta de cada jugador para enseñársela en grande, en secreto.
            </p>
            <ul className="role-list">
              {assignments.map((a, i) => (
                <li key={`${a.name}-${i}`} className="role-row">
                  <CardThumb id={a.roleId} size="sm" onOpen={(id) => show(id, a.name)} />
                  <strong className="grow">{a.name}</strong>
                  <select
                    className="select"
                    value={a.roleId}
                    aria-label={`Rol de ${a.name}`}
                    onChange={(e) => changeRole(i, e.target.value as RoleId)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {hasThief && <ExtraCards title="Cartas sobrantes para el ladrón" ids={thiefCards} onOpen={show} />}
            {actorCards.length > 0 && <ExtraCards title="Cartas del comediante (boca arriba)" ids={actorCards} onOpen={show} />}
            {dealtErrors.length > 0 && (
              <ul className="errors" role="alert">
                {dealtErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <p className="muted small">
              {Object.entries(countRoles(assignments))
                .map(([id, c]) => `${c} ${getRole(id as RoleId).name}`)
                .join(' · ')}
            </p>
          </>
        )}
      </section>

      <ActionBar>
        <button
          type="button"
          className="btn btn-primary btn-big"
          disabled={!canStart}
          onClick={() => assignments && onStart(createGame(assignments, rules, thiefCards))}
        >
          Empezar la primera noche
        </button>
      </ActionBar>
      {modal}
    </>
  )
}

function ExtraCards({ title, ids, onOpen }: { title: string; ids: RoleId[]; onOpen: (id: RoleId) => void }) {
  return (
    <div className="stack">
      <h3>{title}</h3>
      <div className="card-choice">
        {ids.map((id, i) => (
          <div key={`${id}-${i}`} className="card-option">
            <CardThumb id={id} size="md" onOpen={onOpen} />
            <span>{getRole(id).name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
