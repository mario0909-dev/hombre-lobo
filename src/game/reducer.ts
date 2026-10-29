import { actingAs, alivePlayers, currentStep, foxSmellsWolf, hasPower, nameOf, playerById, validTargets, wolfVictim } from './night'
import { getRole } from './roles'
import { applyDeaths, checkWinner } from './resolve'
import { buildNightSteps, rebuildRemainingSteps } from './steps'
import { GameRuleError } from './types'
import type { Action, Death, DeathCause, GameState, LogEntry, NightStepId, Player } from './types'

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

function requireTarget(state: GameState, step: NightStepId, id: string, message: string): void {
  requireAlive(state, id)
  if (!validTargets(state, step).some((p) => p.id === id)) fail(message)
}

function withActions(state: GameState, patch: Partial<GameState['night']['actions']>): GameState {
  return { ...state, night: { ...state.night, actions: { ...state.night.actions, ...patch } } }
}

function updatePlayer(state: GameState, id: string, patch: (p: Player) => Player): GameState {
  return { ...state, players: state.players.map((p) => (p.id === id ? patch(p) : p)) }
}

function addLog(state: GameState, text: string): GameState {
  const entry: LogEntry = { round: state.round, text }
  return { ...state, log: [...state.log, entry] }
}

function aliveWithRole(state: GameState, roleId: Player['roleId']): Player | undefined {
  return alivePlayers(state).find((p) => p.roleId === roleId)
}

function startNight(state: GameState): GameState {
  const s: GameState = {
    ...state,
    phase: 'night',
    round: state.round + 1,
    ravenMark: null,
    medium: null,
    night: { steps: [], stepIndex: 0, actions: {} },
  }
  return { ...s, night: { ...s.night, steps: buildNightSteps(s) } }
}

function winnerOf(state: GameState) {
  return checkWinner(state.players, state.lovers, state)
}

/** Decide a dónde ir cuando una resolución de muertes ha terminado. */
function afterResolution(state: GameState, next: 'day' | 'night'): GameState {
  if (state.pendingHunters.length) return { ...state, phase: 'hunter', afterHunter: next }
  const winner = winnerOf(state)
  if (winner) return finish(state, winner)
  if (next === 'day') return { ...state, phase: 'day' }
  if (state.judge.secondVote) {
    const s = { ...state, phase: 'day' as const, judge: { ...state.judge, secondVote: false } }
    return addLog(s, 'Por la señal del juez, el pueblo vuelve a votar.')
  }
  return startNight(state)
}

function finish(state: GameState, winner: NonNullable<GameState['winner']>): GameState {
  const label = {
    villa: 'Ganan los aldeanos',
    lobos: 'Ganan los hombres lobo',
    amantes: 'Ganan los enamorados',
    angel: 'Gana el ángel',
    flautista: 'Gana el flautista',
    loboBlanco: 'Gana el lobo blanco',
    sectario: 'Gana el sectario abominable',
    nadie: 'Nadie gana: no queda nadie vivo',
  }[winner]
  return addLog({ ...state, phase: 'gameOver', winner }, `Fin de la partida. ${label}.`)
}

function resolveNight(state: GameState): GameState {
  const a = state.night.actions
  let s = state

  // Resumen de lo ocurrido, solo para el narrador.
  if (a.lobo !== undefined) s = addLog(s, `Los lobos eligen a ${nameOf(s, a.lobo)}.`)
  if (a.loboFeroz) s = addLog(s, `El gran lobo feroz elige a ${nameOf(s, a.loboFeroz)}.`)
  if (a.loboBlanco) s = addLog(s, `El lobo blanco elige a ${nameOf(s, a.loboBlanco)}.`)
  if (a.guardian) s = addLog(s, `El guardián protege a ${nameOf(s, a.guardian)}.`)
  if (a.vidente) {
    const target = playerById(s, a.vidente)
    if (target) s = addLog(s, `La vidente mira a ${target.name}: es ${getRole(target.roleId).name}.`)
  }
  const fox = aliveWithRole(s, 'zorro')
  let foxPowerLost = s.foxPowerLost
  if (a.zorro) {
    const smells = foxSmellsWolf(s, a.zorro)
    s = addLog(s, `El zorro olfatea a ${nameOf(s, a.zorro)}: ${smells ? 'huele a lobo' : 'no huele a lobo'}.`)
    // Solo el zorro de verdad pierde el olfato; el comediante descarta la carta igualmente.
    if (!smells && fox && hasPower(s, fox)) foxPowerLost = true
  }
  if (a.cuervo) s = addLog(s, `El cuervo señala a ${nameOf(s, a.cuervo)}.`)
  if (a.gitana) s = addLog(s, `La gitana elige a ${nameOf(s, a.gitana)} para hablar con los espíritus.`)
  if (a.flautista?.length) s = addLog(s, `El flautista encanta a ${a.flautista.map((id) => nameOf(s, id)).join(' y ')}.`)
  if (a.comediante) s = addLog(s, `El comediante usa la carta de ${getRole(a.comediante).name}.`)

  const saved = !!a.brujaSalva && !s.witch.lifeUsed
  const poison = a.brujaVeneno && !s.witch.deathUsed ? a.brujaVeneno : null
  if (saved) s = addLog(s, 'La bruja usa su poción de vida.')
  if (poison) s = addLog(s, `La bruja envenena a ${nameOf(s, poison)}.`)

  const deaths: Death[] = []
  let { elderHit, infectUsed } = s

  if (s.rustNext && playerById(s, s.rustNext)?.alive) deaths.push({ playerId: s.rustNext, cause: 'oxido' })

  /** Ataque de lobos: lo para el guardián (y la bruja, si es la víctima principal) y el anciano lo aguanta una vez. */
  const attack = (id: string, cause: DeathCause, witchSaves: boolean) => {
    const guarded = a.guardian === id
    let dies = true
    if (guarded && witchSaves) dies = s.rules.doubleSave === 'dies'
    else if (guarded || witchSaves) dies = false
    if (!dies) return
    if (cause === 'lobos' && id === a.lobo && a.infectar && !infectUsed) {
      infectUsed = true
      s = updatePlayer(s, id, (p) => ({ ...p, wolf: true }))
      s = addLog(s, `El padre de los lobos infecta a ${nameOf(s, id)}: ahora es un hombre lobo.`)
      return
    }
    if (playerById(s, id)?.roleId === 'anciano' && cause === 'lobos' && !elderHit) {
      elderHit = true
      s = addLog(s, `${nameOf(s, id)} es el anciano: resiste el ataque de los lobos.`)
      return
    }
    deaths.push({ playerId: id, cause })
  }

  if (a.lobo) attack(a.lobo, 'lobos', saved)
  if (a.loboFeroz) attack(a.loboFeroz, 'lobos', false)
  if (a.loboBlanco) attack(a.loboBlanco, 'loboBlanco', false)
  if (poison) deaths.push({ playerId: poison, cause: 'veneno' })

  s = {
    ...s,
    witch: {
      lifeUsed: s.witch.lifeUsed || saved,
      deathUsed: s.witch.deathUsed || !!poison,
    },
    guardianLast: a.guardian ?? null,
    elderHit,
    infectUsed,
    foxPowerLost,
    enchanted: [...s.enchanted, ...(a.flautista ?? [])],
    ravenMark: a.cuervo ?? null,
    medium: a.gitana ?? null,
    actorCards: a.comediante ? s.actorCards.filter((r) => r !== a.comediante) : s.actorCards,
    rustNext: null,
  }
  s = applyDeaths(s, deaths)
  if (s.lastDeaths.length === 0) s = addLog(s, 'Nadie muere esta noche.')
  return { ...s, phase: 'dawn' }
}

/** Qué falta por decidir en el paso actual antes de poder seguir (o `null`). */
export function missingChoice(state: GameState): string | null {
  const a = state.night.actions
  switch (currentStep(state)) {
    case 'ladron':
      return a.ladron === undefined ? 'El ladrón tiene que decidir si cambia de carta.' : null
    case 'perroLobo':
      return a.perroLobo === undefined ? 'El perro lobo tiene que elegir bando.' : null
    case 'cupido':
      return a.cupido ? null : 'Cupido tiene que elegir a la pareja.'
    case 'ninoSalvaje':
      return a.ninoSalvaje ? null : 'El niño salvaje tiene que elegir a su modelo.'
    case 'sectario':
      return a.sectario ? null : 'Marca a los jugadores del grupo del sectario.'
    case 'lobo':
      return a.lobo === undefined ? 'Los lobos tienen que elegir una víctima (o ninguna).' : null
    case 'flautista':
      return a.flautista === undefined && validTargets(state, 'flautista').length
        ? 'El flautista tiene que elegir a quién encanta.'
        : null
    default:
      return null
  }
}

/**
 * Función pura: `(estado, acción) => estado nuevo`. Lanza `GameRuleError` si la
 * acción no es válida. No usa azar: el reparto de roles se decide antes y se guarda.
 */
export function aplicar(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'LADRON_ELIGE': {
      requireStep(state, 'ladron')
      const a = state.night.actions
      if (a.ladron !== undefined) fail('El ladrón ya ha decidido. Para cambiarlo, usa «Deshacer».')
      const thief = actingAs(state, 'ladron')[0]
      if (!thief) fail('No hay ladrón.')
      if (action.card === null) {
        if (state.thiefCards.every((r) => getRole(r).team === 'lobos')) {
          fail('Las dos cartas son de lobo: el ladrón tiene que coger una.')
        }
        return addLog(withActions(state, { ladron: { thief: thief.id, took: null } }), `${thief.name}, el ladrón, se queda con su carta.`)
      }
      const card = action.card
      const taken = state.thiefCards[card]
      if (!taken) fail('Esa carta no existe.')
      let s = updatePlayer(state, thief.id, (p) => ({ ...p, roleId: taken }))
      s = { ...s, thiefCards: s.thiefCards.map((r, i) => (i === card ? 'ladron' : r)) }
      s = withActions(s, { ladron: { thief: thief.id, took: taken } })
      s = addLog(s, `${thief.name}, el ladrón, coge la carta de ${getRole(taken).name}.`)
      return rebuildRemainingSteps(s)
    }

    case 'COMEDIANTE_ELIGE': {
      requireStep(state, 'comediante')
      if (action.role !== null && !state.actorCards.includes(action.role)) fail('El comediante no tiene esa carta.')
      return rebuildRemainingSteps(withActions(state, { comediante: action.role }))
    }

    case 'PERRO_LOBO_ELIGE': {
      requireStep(state, 'perroLobo')
      const dog = aliveWithRole(state, 'perroLobo')
      if (!dog) fail('No hay perro lobo.')
      const s = updatePlayer(state, dog.id, (p) => {
        const next = { ...p }
        if (action.side === 'lobos') next.wolf = true
        else delete next.wolf
        return next
      })
      return withActions(s, { perroLobo: action.side })
    }

    case 'CUPIDO_ELIGE': {
      requireStep(state, 'cupido')
      if (action.a === action.b) fail('Cupido debe elegir a dos jugadores distintos.')
      requireAlive(state, action.a)
      requireAlive(state, action.b)
      const lovers: [string, string] = [action.a, action.b]
      const s = withActions({ ...state, lovers }, { cupido: lovers })
      return addLog(s, `Cupido enamora a ${nameOf(s, action.a)} y ${nameOf(s, action.b)}.`)
    }

    case 'NINO_SALVAJE_ELIGE': {
      requireStep(state, 'ninoSalvaje')
      requireTarget(state, 'ninoSalvaje', action.target, 'El niño salvaje no puede elegirse a sí mismo.')
      const s = withActions({ ...state, wildChildModel: action.target }, { ninoSalvaje: action.target })
      return addLog(s, `El niño salvaje elige como modelo a ${nameOf(s, action.target)}.`)
    }

    case 'SECTARIO_GRUPO': {
      requireStep(state, 'sectario')
      const sectarian = aliveWithRole(state, 'sectario')
      if (!sectarian) fail('No hay sectario.')
      const ids = [...new Set([sectarian.id, ...action.ids])]
      for (const id of ids) if (!playerById(state, id)) fail('Jugador desconocido.')
      if (ids.length >= state.players.length) fail('Tiene que haber alguien en el grupo contrario.')
      return withActions({ ...state, sect: ids }, { sectario: ids })
    }

    case 'GUARDIAN_ELIGE': {
      requireStep(state, 'guardian')
      if (action.target !== null) {
        requireTarget(state, 'guardian', action.target, 'El guardián no puede proteger a ese jugador con las reglas actuales.')
      }
      return withActions(state, { guardian: action.target })
    }

    case 'LOBOS_ELIGEN': {
      requireStep(state, 'lobo')
      if (action.target !== null) requireAlive(state, action.target)
      return withActions(state, { lobo: action.target })
    }

    case 'LOBOS_INFECTAN': {
      requireStep(state, 'lobo')
      if (action.infect) {
        if (!aliveWithRole(state, 'padreLobos')) fail('No hay padre de los lobos vivo.')
        if (state.infectUsed) fail('El padre de los lobos ya ha infectado a alguien.')
        if (!state.night.actions.lobo) fail('Primero hay que elegir a la víctima.')
      }
      return withActions(state, { infectar: action.infect })
    }

    case 'LOBO_FEROZ_ELIGE': {
      requireStep(state, 'loboFeroz')
      if (action.target !== null) {
        requireTarget(state, 'loboFeroz', action.target, 'El gran lobo feroz debe elegir a otro que no sea lobo ni la primera víctima.')
      }
      return withActions(state, { loboFeroz: action.target })
    }

    case 'LOBO_BLANCO_ELIGE': {
      requireStep(state, 'loboBlanco')
      if (action.target !== null) {
        requireTarget(state, 'loboBlanco', action.target, 'El lobo blanco solo puede devorar a otro hombre lobo.')
      }
      return withActions(state, { loboBlanco: action.target })
    }

    case 'VIDENTE_ELIGE': {
      requireStep(state, 'vidente')
      requireTarget(state, 'vidente', action.target, 'La vidente no puede mirarse a sí misma.')
      return withActions(state, { vidente: action.target })
    }

    case 'ZORRO_ELIGE': {
      requireStep(state, 'zorro')
      if (action.target !== null) requireAlive(state, action.target)
      return withActions(state, { zorro: action.target })
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
        requireTarget(state, 'bruja', action.target, 'La bruja no puede envenenarse a sí misma.')
        if (state.night.actions.brujaSalva && !state.rules.witchBothPotionsSameNight) {
          fail('La bruja no puede usar las dos pociones la misma noche.')
        }
      }
      return withActions(state, { brujaVeneno: action.target })
    }

    case 'FLAUTISTA_ELIGE': {
      requireStep(state, 'flautista')
      const targets = [...new Set(action.targets)]
      const valid = validTargets(state, 'flautista')
      for (const id of targets) requireTarget(state, 'flautista', id, 'El flautista no puede encantar a ese jugador.')
      if (targets.length !== Math.min(2, valid.length)) fail('El flautista tiene que encantar a dos jugadores.')
      return withActions(state, { flautista: targets })
    }

    case 'CUERVO_ELIGE': {
      requireStep(state, 'cuervo')
      if (action.target !== null) requireAlive(state, action.target)
      return withActions(state, { cuervo: action.target })
    }

    case 'GITANA_ELIGE': {
      requireStep(state, 'gitana')
      if (action.target !== null) requireAlive(state, action.target)
      return withActions(state, { gitana: action.target })
    }

    case 'SIGUIENTE_PASO': {
      requirePhase(state, 'night')
      const missing = missingChoice(state)
      if (missing) fail(missing)
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

    case 'ALGUACIL_NOMBRA': {
      requirePhase(state, 'dawn', 'day')
      if (!state.rules.sheriff) fail('En esta partida no se juega con alguacil.')
      requireAlive(state, action.playerId)
      return addLog({ ...state, sheriff: action.playerId }, `${nameOf(state, action.playerId)} es el nuevo alguacil.`)
    }

    case 'JUEZ_SEGUNDA_VOTACION': {
      requirePhase(state, 'day')
      const judge = aliveWithRole(state, 'juez')
      if (!judge || !hasPower(state, judge)) fail('No hay juez tartamudo con poder.')
      if (state.judge.used) fail('El juez ya ha usado su señal.')
      const s = { ...state, judge: { used: true, secondVote: true } }
      return addLog(s, 'El juez tartamudo hace su señal: habrá una segunda votación.')
    }

    case 'VOTAR_LINCHAMIENTO': {
      requirePhase(state, 'day')
      if (action.target === null) {
        const goat = aliveWithRole(state, 'chivo')
        if (goat) {
          const s = addLog(state, 'Empate en la votación: muere el chivo expiatorio.')
          return afterResolution(applyDeaths(s, [{ playerId: goat.id, cause: 'chivo' }]), 'night')
        }
        const s = addLog({ ...state, lastDeaths: [] }, 'Empate en la votación: no muere nadie.')
        return afterResolution(s, 'night')
      }
      requireAlive(state, action.target)
      const target = playerById(state, action.target) as Player
      if (target.roleId === 'tonto' && !state.idiotRevealed) {
        if (action.servant) fail('El tonto del pueblo no muere: la sirvienta no puede quedarse con su carta.')
        const s = addLog(
          { ...state, idiotRevealed: true, lastDeaths: [] },
          `${target.name} es el tonto del pueblo: se salva, pero ya no podrá votar.`,
        )
        return afterResolution(s, 'night')
      }
      let s = state
      if (action.servant) {
        const maid = aliveWithRole(state, 'sirvienta')
        if (!maid) fail('No hay sirvienta viva.')
        if (maid.id === target.id) fail('La sirvienta no puede quedarse con su propia carta.')
        if (state.lovers?.includes(maid.id)) fail('Una sirvienta enamorada no puede revelarse.')
        s = updatePlayer(s, maid.id, (p) => ({ ...p, roleId: target.roleId }))
        s = updatePlayer(s, target.id, (p) => ({ ...p, roleId: 'sirvienta' }))
        s = addLog(s, `${maid.name}, la sirvienta, se queda con la carta de ${target.name}: ${getRole(target.roleId).name}.`)
      }
      s = applyDeaths(s, [{ playerId: action.target, cause: 'votacion' }])
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
        x.id === p.id
          ? { id: x.id, name: x.name, roleId: x.roleId, alive: true, ...(x.wolf ? { wolf: true as const } : {}) }
          : x,
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
  const winner = winnerOf(state)
  return winner ? finish(state, winner) : state
}
