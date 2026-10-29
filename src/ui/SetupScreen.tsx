import { useMemo, useState } from 'react'
import {
  countRoles,
  createGame,
  dealRoles,
  DEFAULT_RULES,
  getRole,
  MIN_PLAYERS,
  parseNames,
  ROLES,
  specialRoleTotal,
  suggestRoleCounts,
  validateSetup,
} from '../game'
import type { Assignment, GameState, HouseRules, RoleCounts, RoleId } from '../game'
import { ActionBar } from './components'

const DEMO = 'Ana\nLuis\nMarta\nPablo\nSergio\nClara\nIván\nLucía\nDiego\nElena'
const UNIQUE: RoleId[] = ['vidente', 'bruja', 'cazador', 'cupido', 'guardian', 'nina']

export function SetupScreen({ onStart }: { onStart: (state: GameState) => void }) {
  const [namesText, setNamesText] = useState('')
  const [userCounts, setUserCounts] = useState<RoleCounts | null>(null)
  const [rules, setRules] = useState<HouseRules>(DEFAULT_RULES)
  const [dealt, setDealt] = useState<{ forNames: string; assignments: Assignment[] } | null>(null)

  const names = useMemo(() => parseNames(namesText), [namesText])
  const n = names.length
  const counts = userCounts ?? suggestRoleCounts(n)
  const villagers = Math.max(0, n - specialRoleTotal(counts))
  const configErrors = validateSetup(names, counts)

  // El reparto solo vale mientras la lista de jugadores sea la misma con la que se hizo.
  const assignments = dealt && dealt.forNames === names.join('\n') ? dealt.assignments : null
  const dealtErrors = assignments ? validateSetup(names, countRoles(assignments)) : []

  const setCount = (id: RoleId, value: number) => {
    setUserCounts({ ...counts, [id]: Math.max(0, value) })
    setDealt(null)
  }

  const deal = () => {
    const roles = dealRoles(n, counts, Math.random)
    setDealt({ forNames: names.join('\n'), assignments: names.map((name, i) => ({ name, roleId: roles[i] })) })
  }

  const changeRole = (index: number, roleId: RoleId) => {
    if (!assignments) return
    const next = assignments.map((a, i) => (i === index ? { ...a, roleId } : a))
    setDealt({ forNames: names.join('\n'), assignments: next })
  }

  const setRule = <K extends keyof HouseRules>(key: K, value: HouseRules[K]) =>
    setRules((r) => ({ ...r, [key]: value }))

  const maxWolves = Math.max(1, Math.floor((n - 1) / 2))
  const canStart = assignments !== null && dealtErrors.length === 0

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
          <span className="muted small">Un nombre por línea (mínimo {MIN_PLAYERS})</span>
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
          <h2>2 · Roles</h2>
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
        <ul className="role-list">
          {ROLES.filter((r) => r.id !== 'aldeano').map((r) => {
            const value = counts[r.id] ?? 0
            const max = r.id === 'lobo' ? maxWolves : UNIQUE.includes(r.id) ? 1 : n
            return (
              <li key={r.id} className="role-row">
                <div>
                  <strong>{r.name}</strong>
                  <div className="muted small">{r.description}</div>
                </div>
                <div className="stepper">
                  <button type="button" className="btn btn-ghost btn-small" aria-label={`Menos ${r.name}`} disabled={value <= 0} onClick={() => setCount(r.id, value - 1)}>
                    −
                  </button>
                  <span className="stepper-value" aria-live="polite">{value}</span>
                  <button type="button" className="btn btn-ghost btn-small" aria-label={`Más ${r.name}`} disabled={value >= max} onClick={() => setCount(r.id, value + 1)}>
                    +
                  </button>
                </div>
              </li>
            )
          })}
          <li className="role-row">
            <div>
              <strong>Aldeanos</strong>
              <div className="muted small">Se añaden solos hasta completar los jugadores.</div>
            </div>
            <span className="stepper-value">{villagers}</span>
          </li>
        </ul>
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
            <p className="muted small">Solo lo ves tú, el narrador. Entrega las cartas en secreto.</p>
            <ul className="role-list">
              {assignments.map((a, i) => (
                <li key={`${a.name}-${i}`} className="role-row">
                  <strong>{a.name}</strong>
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
          onClick={() => assignments && onStart(createGame(assignments, rules))}
        >
          Empezar la primera noche
        </button>
      </ActionBar>
    </>
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
