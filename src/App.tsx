import { useState } from 'react'
import { useInstall, useWakeLock, useGame, useSpeech, useTheme } from './ui/hooks'
import { PlayersPanel, LogPanel } from './ui/components'
import { DawnScreen, DayScreen, GameOverScreen, HunterScreen } from './ui/DayScreens'
import { NightScreen } from './ui/NightScreen'
import { SetupScreen } from './ui/SetupScreen'
import type { GameState } from './game'

export default function App() {
  const { game, resumable, canUndo, error, dispatch, undo, start, resume, quit } = useGame()
  const { theme, toggle: toggleTheme } = useTheme()
  const speech = useSpeech()
  const installer = useInstall()
  const [showIosHint, setShowIosHint] = useState(false)
  useWakeLock(game !== null && game.phase !== 'gameOver')

  const confirmQuit = () => {
    if (window.confirm('¿Abandonar la partida actual? Se perderá el progreso.')) quit()
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">🌙</span>
          <div>
            <h1>Castronegro</h1>
            <p className="muted small">Asistente del narrador</p>
          </div>
        </div>
        <div className="top-actions">
          {!game && installer.canPrompt && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => void installer.install()}>
              Instalar
            </button>
          )}
          {!game && !installer.canPrompt && installer.iosHint && (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowIosHint((v) => !v)} aria-expanded={showIosHint}>
              Instalar
            </button>
          )}
          {game && (
            <button type="button" className="btn btn-ghost btn-small" onClick={undo} disabled={!canUndo} aria-label="Deshacer el último paso">
              ↩ Deshacer
            </button>
          )}
          {speech.supported && (
            <button
              type="button"
              className={`btn btn-ghost btn-small${speech.enabled ? ' active' : ''}`}
              onClick={speech.toggle}
              aria-pressed={speech.enabled}
              aria-label="Leer el guion en voz alta automáticamente"
              title="Lectura automática en voz alta"
            >
              🔊
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-small" onClick={toggleTheme} aria-label="Cambiar tema claro u oscuro">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {game && (
            <button type="button" className="btn btn-ghost btn-small" onClick={confirmQuit}>
              Salir
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {showIosHint && !game && (
          <p className="hint card">
            Para instalarla en iPhone o iPad: ábrela en <strong>Safari</strong>, toca <strong>Compartir</strong> (el cuadrado
            con la flecha) y elige <strong>«Añadir a pantalla de inicio»</strong>.
          </p>
        )}
        {error && (
          <p className="toast" role="alert">
            {error}
          </p>
        )}

        {!game && resumable && <ResumeCard saved={resumable.present} onResume={resume} onDiscard={quit} />}
        {!game && !resumable && <SetupScreen onStart={start} />}

        {game?.phase === 'night' && (
          <>
            <NightScreen state={game} dispatch={dispatch} speech={speech} />
            <PlayersPanel state={game} editable={false} onKill={() => {}} onRevive={() => {}} />
            <LogPanel state={game} />
          </>
        )}
        {game?.phase === 'dawn' && <DawnScreen state={game} dispatch={dispatch} speech={speech} />}
        {game?.phase === 'hunter' && <HunterScreen state={game} dispatch={dispatch} speech={speech} />}
        {game?.phase === 'day' && <DayScreen state={game} dispatch={dispatch} speech={speech} />}
        {game?.phase === 'gameOver' && <GameOverScreen state={game} onNewGame={quit} speech={speech} />}
      </main>
    </div>
  )
}

function ResumeCard({ saved, onResume, onDiscard }: { saved: GameState; onResume: () => void; onDiscard: () => void }) {
  const alive = saved.players.filter((p) => p.alive).length
  const phase = {
    night: `noche ${saved.round}`,
    dawn: `amanecer de la noche ${saved.round}`,
    hunter: 'disparo del cazador',
    day: `día ${saved.round}`,
    gameOver: 'partida terminada',
  }[saved.phase]
  return (
    <section className="card">
      <h2>Tienes una partida a medias</h2>
      <p className="muted">
        {saved.players.length} jugadores, {alive} vivos · {phase}
      </p>
      <div className="stack">
        <button type="button" className="btn btn-primary btn-big" onClick={onResume}>
          Continuar partida
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm('¿Empezar una partida nueva? Se perderá la que tienes guardada.')) onDiscard()
          }}
        >
          Nueva partida
        </button>
      </div>
    </section>
  )
}
