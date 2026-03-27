import { useState, useEffect, useRef } from 'react'
import Button from '../common/Button'

function pad(n) { return String(n).padStart(2, '0') }

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function WorklogTimer({ onStop }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)   // Sekunden
  const [description, setDescription] = useState('')
  const intervalRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    return () => clearInterval(intervalRef.current)
  }, [])

  function start() {
    startTimeRef.current = Date.now() - elapsed * 1000
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
  }

  function pause() {
    clearInterval(intervalRef.current)
    setRunning(false)
  }

  function stop() {
    clearInterval(intervalRef.current)
    setRunning(false)
    if (elapsed < 60) {
      setElapsed(0)
      return
    }
    const minutes = Math.max(1, Math.round(elapsed / 60))
    const today = new Date().toISOString().split('T')[0]
    onStop({ date: today, duration_min: minutes, description })
    setElapsed(0)
    setDescription('')
  }

  function reset() {
    clearInterval(intervalRef.current)
    setRunning(false)
    setElapsed(0)
    setDescription('')
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3">
      {/* Anzeige */}
      <div className="flex items-center justify-between">
        <span className={`font-mono text-2xl font-bold tabular-nums ${running ? 'text-primary-600' : 'text-gray-700'}`}>
          {formatElapsed(elapsed)}
        </span>
        <div className="flex gap-2">
          {!running ? (
            <Button size="sm" onClick={start} disabled={false}>
              {elapsed > 0 ? '▶ Weiter' : '▶ Start'}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={pause}>⏸ Pause</Button>
          )}
          {elapsed > 0 && (
            <>
              <Button
                size="sm"
                onClick={stop}
                disabled={elapsed < 60}
                title={elapsed < 60 ? 'Mindestens 1 Minute nötig' : ''}
              >
                ■ Buchen
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>✕</Button>
            </>
          )}
        </div>
      </div>

      {/* Beschreibung – nur sichtbar wenn Timer läuft oder pausiert */}
      {elapsed > 0 && (
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Was wird gerade gemacht? (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )}

      {elapsed > 0 && elapsed < 60 && (
        <p className="text-xs text-gray-400">Mindestens 1 Minute für Buchung erforderlich</p>
      )}
    </div>
  )
}
