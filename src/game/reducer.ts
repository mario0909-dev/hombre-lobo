import { buildNightSteps, currentStep, nameOf, playerById, validTargets, wolfVictim } from './night'
import { getRole } from './roles'
import { applyDeaths, checkWinner } from './resolve'
import { GameRuleError } from './types'
import type { Action, Death, GameState, LogEntry, NightStepId } from './types'

function fail(message: string): never {
  throw new GameRuleError(message)
}

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) fail(`Acción no válida en la fase "${state.phase}".`)
}

function requireStep(state: GameState, step: NightStepId): void {
  requirePhase(state, 'night')
  if (currentStep(state) !== step) fail(`Ahora no es el turno de "${step}".`)
}

function requireAlive(state: GameState, id: string): void {
  const p = playerById(state, id)
  if (!p) fail('Jugador desconocido.')
  if (!p.alive) fail(`${p.name} ya está muerto.`)
}

function withActions(state: GameState, patch: Partial<GameState['night']['actions']>): GameState {
  return { ...state, night: { ...state.night, actions: { ...state.night.actions, ...patch } } }
}

function addLog(state: GameState, text: string): GameState {
  const entry: LogEntry = { round: state.round, text }
  return { ...state, log: [...state.log, entry] }
}

function startNight(state: GameState): GameState {
  const round = state.round + 1
  return {
    ...state,
    phase: 'night',
    round,
    night: { steps: buildNightSteps(state.players, round), stepIndex: 0, actions: {} },
  }
}

/** Decide a dónde ir cuando una resolución de muertes ha terminado. */
function afterResolution(state: GameState, next: 'day' | 'night'): GameState {
  if (state.pendingHunters.length) return { ...state, phase: 'hunter', afterHunter: next }
  const winner = checkWinner(state.players, state.lovers)
  if (winner) return finish(state, winner)
  return next === 'day' ? { ...state, phase: 'day' } : startNight(state)
}

function finish(state: GameState, winner: NonNullable<GameState['winner']>): GameState {
  const label = {
    villa: 'Ganan los aldeanos',
    lobos: 'Ganan los hombres lobo',
    amantes: 'Ganan los enamorados',
    nadie: 'Nadie gana: no queda nadie vivo',
  }[winner]
  return addLog({ ...state, phase: 'gameOver', winner }, `Fin de la partida. ${label}.`)
}

function resolveNight(state: GameState): GameState {
  const a = state.night.actions
  let s = state

  // Resumen de lo ocurrido, solo para el narrador.
  if (a.lobo !== undefined) s = addLog(s, `Los lobos eligen a ${nameOf(s, a.lobo)}.`)
  if (a.guardian) s = addLog(s, `El guardián protege a ${nameOf(s, a.guardian)}.`)
  if (a.vidente) {
    const target = playerById(s, a.vidente)
    if (target) s = addLog(s, `La vidente mira a ${target.name}: es ${getRole(target.roleId).name}.`)
  }

  const victim = a.lobo ?? null
  const saved = !!a.brujaSalva && !s.witch.lifeUsed
  const poison = a.brujaVeneno && !s.witch.deathUsed ? a.brujaVeneno : null
  if (saved) s = addLog(s, 'La bruja usa su poción de vida.')
  if (poison) s = addLog(s, `La bruja envenena a ${nameOf(s, poison)}.`)

  const deaths: Death[] = []
  if (victim) {
    const guarded = a.guardian === victim
    let dies = true
    if (guarded && saved) dies = s.rules.doubleSave === 'dies'
    else if (guarded || saved) dies = false
    if (dies) deaths.push({ playerId: victim, cause: 'lobos' })
  }
  if (poison) deaths.push({ playerId: poison, cause: 'veneno' })

  s = {
    ...s,
    witch: {
      lifeUsed: s.witch.lifeUsed || saved,
      deathUsed: s.witch.deathUsed || !!poison,
    },
    guardianLast: a.guardian ?? null,
  }
  s = applyDeaths(s, deaths)
  if (s.lastDeaths.length === 0) s = addLog(s, 'Nadie muere esta noche.')
  return { ...s, phase: 'dawn' }
}

/**
 * Función pura: `(estado, acción) => estado nuevo`. Lanza `GameRuleError` si la
 * acción no es válida. No usa azar: el reparto de roles se decide antes y se guarda.
 */
export function aplicar(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CUPIDO_ELIGE': {
      requireStep(state, 'cupido')
      if (action.a === action.b) fail('Cupido debe elegir a dos jugadores distintos.')
      requireAlive(state, action.a)
      requireAlive(state, action.b)
      const lovers: [string, string] = [action.a, action.b]
      const s = withActions({ ...state, lovers }, { cupido: lovers })
      return addLog(s, `Cupido enamora a ${nameOf(s, action.a)} y ${nameOf(s, action.b)}.`)
    }

    case 'GUARDIAN_ELIGE': {
      requireStep(state, 'guardian')
      if (action.target !== null) {
        requireAlive(state, action.target)
        if (!validTargets(state, 'guardian').some((p) => p.id === action.target)) {
          fail('El guardián no puede proteger a ese jugador con las reglas actuales.')
        }
      }
      return withActions(state, { guardian: action.target })
    }

    case 'LOBOS_ELIGEN': {
      requireStep(state, 'lobo')
      if (action.target !== null) requireAlive(state, action.target)
      return withActions(state, { lobo: action.target })
    }

    case 'VIDENTE_ELIGE': {
      requireStep(state, 'vidente')
      requireAlive(state, action.target)
      if (!validTargets(state, 'vidente').some((p) => p.id === action.target)) {
        fail('La vidente no puede mirarse a sí misma.')
      }
      return withActions(state, { vidente: action.target })
    }

    case 'BRUJA_SALVA': {
      requireStep(state, 'bruja')
      if (action.save) {
        if (state.witch.lifeUsed) fail('La bruja ya gastó su poción de vida.')
        const victim = wolfVictim(state)
        if (!victim) fail('No hay víctima a la que salvar.')
        if (victim.roleId === 'bruja' && !state.rules.witchCanSelfSave) {
          fail('Con las reglas actuales la bruja no puede salvarse a sí misma.')
        }
        if (state.night.actions.brujaVeneno && !state.rules.witchBothPotionsSameNight) {
          fail('La bruja no puede usar las dos pociones la misma noche.')
        }
      }
      return withActions(state, { brujaSalva: action.save })
    }

    case 'BRUJA_ENVENENA': {
      requireStep(state, 'bruja')
      if (action.target !== null) {
        if (state.witch.deathUsed) fail('La bruja ya gastó su poción de muerte.')
        requireAlive(state, action.target)
        if (!validTargets(state, 'bruja').some((p) => p.id === action.target)) {
          fail('La bruja no puede envenenarse a sí misma.')
        }
        if (state.night.actions.brujaSalva && !state.rules.witchBothPotionsSameNight) {
          fail('La bruja no puede usar las dos pociones la misma noche.')
        }
      }
      return withActions(state, { brujaVeneno: action.target })
    }

    case 'SIGUIENTE_PASO': {
      requirePhase(state, 'night')
      const step = currentStep(state)
      if (step === 'cupido' && !state.night.actions.cupido) fail('Cupido tiene que elegir a la pareja.')
      if (step === 'lobo' && state.night.actions.lobo === undefined) {
        fail('Los lobos tienen que elegir una víctima (o ninguna).')
      }
      if (state.night.stepIndex < state.night.steps.length - 1) {
        return { ...state, night: { ...state.night, stepIndex: state.night.stepIndex + 1 } }
      }
      return resolveNight(state)
    }

    case 'CONTINUAR': {
      requirePhase(state, 'dawn')
      return afterResolution(state, 'day')
    }

    case 'CAZADOR_DISPARA': {
      requirePhase(state, 'hunter')
      const shooterId = state.pendingHunters[0]
      if (!shooterId) fail('No hay ningún cazador pendiente.')
      if (action.target !== null) {
        requireAlive(state, action.target)
        if (action.target === shooterId) fail('El cazador no puede dispararse a sí mismo.')
      }
      let s: GameState = { ...state, pendingHunters: state.pendingHunters.slice(1) }
      s = addLog(
        s,
        action.target
          ? `${nameOf(s, shooterId)} dispara a ${nameOf(s, action.target)}.`
          : `${nameOf(s, shooterId)} decide no disparar.`,
      )
      s = applyDeaths(s, action.target ? [{ playerId: action.target, cause: 'cazador' }] : [])
      return afterResolution(s, state.afterHunter)
    }

    case 'VOTAR_LINCHAMIENTO': {
      requirePhase(state, 'day')
      if (action.target === null) {
        const s = addLog({ ...state, lastDeaths: [] }, 'Empate en la votación: no muere nadie.')
        return afterResolution(s, 'night')
      }
      requireAlive(state, action.target)
      const s = applyDeaths(state, [{ playerId: action.target, cause: 'votacion' }])
      return afterResolution(s, 'night')
    }

    case 'MATAR_MANUAL': {
      requirePhase(state, 'dawn', 'day')
      requireAlive(state, action.playerId)
      const s = applyDeaths(state, [{ playerId: action.playerId, cause: 'narrador' }])
      // De día, un cazador muerto dispara enseguida; al amanecer se gestiona al continuar.
      return state.phase === 'day' ? afterResolutionKeepingDay(s) : s
    }

    case 'REVIVIR_MANUAL': {
      requirePhase(state, 'dawn', 'day')
      const p = playerById(state, action.playerId)
      if (!p) fail('Jugador desconocido.')
      if (p.alive) fail(`${p.name} ya está vivo.`)
      const players = state.players.map((x) =>
        x.id === p.id ? { id: x.id, name: x.name, roleId: x.roleId, alive: true } : x,
      )
      const s = {
        ...state,
        players,
        pendingHunters: state.pendingHunters.filter((id) => id !== p.id),
      }
      return addLog(s, `${p.name} vuelve a la partida (decisión del narrador).`)
    }
  }
}

/** Tras una muerte manual de día: cazador pendiente → dispara; si no, comprueba victoria. */
function afterResolutionKeepingDay(state: GameState): GameState {
  if (state.pendingHunters.length) return { ...state, phase: 'hunter', afterHunter: 'day' }
  const winner = checkWinner(state.players, state.lovers)
  return winner ? finish(state, winner) : state
}
