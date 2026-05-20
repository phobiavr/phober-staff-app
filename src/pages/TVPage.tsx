import { useCallback, useEffect, useRef, useState } from 'react'
import { Instance, getInstances, getDevices, buildLogoMap } from '../api/hardware'
import { fetchTvSessions, getTvParams, resolveTvPin } from '../api/tvClient'
import { Session } from '../api/sessions'
import { echo } from '../realtime/echo'

const DEVICE_ICONS: Record<string, string> = {
  PS_VR: '🥽', HTC: '🎮', OCULUS: '🥽', OMNI: '🏃', DOF_3: '💺', PC: '🖥️',
}

function DeviceIcon({ logo, type }: { logo?: string; type: string }) {
  if (logo) return <img src={logo} alt={type} className="w-8 h-8 object-contain" />
  return <span className="text-3xl leading-none mt-0.5">{DEVICE_ICONS[type] ?? '🎮'}</span>
}

const REFRESH_INTERVAL = 30_000

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ---------- SessionCard ----------
function SessionCard({ inst, session, fetchedAt, logo, onExpire }: {
  inst: Instance
  session: Session | null
  fetchedAt: number
  logo?: string
  onExpire: (id: number) => void
}) {
  const { countdown } = inst.schedule
  const sessionStart = session ? new Date(session.started_at ?? session.created_at).getTime() : null
  const endsAt = sessionStart
    ? sessionStart + session!.time * 60 * 1000
    : countdown > 0 ? fetchedAt + countdown * 1000 : null

  const totalSecs = session ? session.time * 60 : countdown > 0 ? countdown : 1
  const startedAt = sessionStart ?? (endsAt ? endsAt - countdown * 1000 : Date.now())

  const [remaining, setRemaining] = useState(() =>
    endsAt ? Math.max(0, Math.floor((endsAt - Date.now()) / 1000)) : 0
  )
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    if (!endsAt) return
    const id = setInterval(() => {
      const secs = Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
      setRemaining(secs)
      if (secs === 0) { clearInterval(id); onExpireRef.current(inst.id) }
    }, 1000)
    return () => clearInterval(id)
  }, [endsAt, inst.id])

  const elapsed = totalSecs - remaining
  const progress = Math.min(1, elapsed / totalSecs)
  const isLow = remaining > 0 && remaining <= 60

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const timeStr = `${h > 0 ? pad(h) + ':' : ''}${pad(m)}:${pad(s)}`

  return (
    <div className={`relative rounded-2xl overflow-hidden flex flex-col h-64 border transition-all
      ${isLow
        ? 'bg-red-950/60 border-red-500/50 shadow-lg shadow-red-900/30'
        : 'bg-orange-950/50 border-orange-500/30 shadow-lg shadow-orange-900/20'
      }`}
    >
      {/* Фоновый градиент */}
      <div className={`absolute inset-0 pointer-events-none ${isLow
        ? 'bg-gradient-to-b from-red-900/20 to-red-950/60'
        : 'bg-gradient-to-b from-orange-900/20 to-gray-950/80'
      }`} />

      {/* Верх: номер + иконка */}
      <div className="relative px-4 pt-4 pb-1 flex items-start justify-between shrink-0">
        <div>
          <p className="text-xs font-semibold text-orange-400/70 uppercase tracking-widest">В сеансе</p>
          <p className="text-base font-bold text-white leading-tight truncate max-w-[11ch]">
            {inst.label || inst.device}
          </p>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      {/* Центр: таймер */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 gap-1">
        <span className={`font-mono font-black tabular-nums leading-none
          ${isLow ? 'text-red-300 animate-pulse text-4xl' : 'text-white text-4xl'}`}>
          {timeStr}
        </span>
        {isLow && (
          <span className="text-xs text-red-400 font-semibold tracking-wide">скоро финиш</span>
        )}
      </div>

      {/* Клиент */}
      {session?.customer && (
        <div className="relative px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-400 truncate">👤 {session.customer}</p>
        </div>
      )}

      {/* Прогресс-бар */}
      <div className="relative h-1.5 bg-gray-800 shrink-0">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-400' : 'bg-orange-400'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

// ---------- QueueCard ----------
function QueueCard({ inst, session, logo }: { inst: Instance; session: Session; logo?: string }) {
  const waitingSince = new Date(session.created_at).getTime()
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - waitingSince) / 1000))

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - waitingSince) / 1000)), 1000)
    return () => clearInterval(id)
  }, [waitingSince])

  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const waitStr = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`

  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col h-64 border border-yellow-500/30 bg-yellow-950/30 shadow-lg shadow-yellow-900/10">
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-900/15 to-gray-950/70 pointer-events-none" />

      <div className="relative px-4 pt-4 pb-1 flex items-start justify-between shrink-0">
        <div>
          <p className="text-xs font-semibold text-yellow-400/70 uppercase tracking-widest">В очереди</p>
          <p className="text-base font-bold text-white leading-tight truncate max-w-[11ch]">
            {inst.label || inst.device}
          </p>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 gap-1">
        <span className="text-xs text-yellow-500/70 uppercase tracking-wide font-medium">ожидает</span>
        <span className="font-mono font-black tabular-nums text-yellow-300 text-4xl leading-none">{waitStr}</span>
        <span className="text-xs text-gray-500">{session.time} мин</span>
      </div>

      {session.customer && (
        <div className="relative px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-400 truncate">👤 {session.customer}</p>
        </div>
      )}

      <div className="relative h-1.5 bg-gray-800 shrink-0">
        <div className="h-full w-full bg-yellow-500/30 rounded-full" />
      </div>
    </div>
  )
}

// ---------- FreeCard ----------
function FreeCard({ inst, logo }: { inst: Instance; logo?: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden flex flex-col h-64 border border-green-500/25 bg-green-950/30 shadow-lg shadow-green-900/10">
      <div className="absolute inset-0 bg-gradient-to-b from-green-900/15 to-gray-950/70 pointer-events-none" />

      <div className="relative px-4 pt-4 pb-1 flex items-start justify-between shrink-0">
        <div>
          <p className="text-xs font-semibold text-green-400/70 uppercase tracking-widest">Свободен</p>
          <p className="text-base font-bold text-white leading-tight truncate max-w-[11ch]">
            {inst.label || inst.device}
          </p>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-2">
        <span className="text-4xl font-black text-green-400">✓</span>
        <span className="text-xs text-green-500/70 font-medium tracking-wide uppercase">готов к игре</span>
      </div>

      <div className="relative h-1.5 bg-gray-800 shrink-0">
        <div className="h-full w-full bg-green-500/30 rounded-full" />
      </div>
    </div>
  )
}

// ---------- PinScreen ----------
function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  const press = (d: string) => {
    if (busy) return
    setDigits(prev => prev.length < 4 ? [...prev, d] : prev)
  }
  const del   = () => { if (!busy) setDigits(prev => prev.slice(0, -1)) }
  const clear = () => { if (!busy) setDigits([]) }

  useEffect(() => {
    if (digits.length !== 4 || busy) return
    setBusy(true)
    setError('')
    resolveTvPin(digits.join(''))
      .then(onSuccess)
      .catch(() => { setError('Неверный или просроченный PIN'); setDigits([]) })
      .finally(() => setBusy(false))
  }, [digits])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      else if (e.key === 'Backspace') del()
      else if (e.key === 'Escape') clear()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const NUMS = ['1','2','3','4','5','6','7','8','9']
  const btnBase = 'w-20 h-20 rounded-full border-2 border-gray-700 bg-gray-800 text-white text-2xl font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:border-blue-500 hover:bg-gray-700 select-none'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-10">
        <p className="text-gray-500 text-sm uppercase tracking-widest">
          {busy ? 'Проверка...' : 'Введите PIN-код'}
        </p>

        <div className="flex gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-4xl font-black transition-all
              ${busy ? 'border-blue-400 bg-blue-900/30' : i === digits.length && digits.length < 4 ? 'border-blue-500 bg-gray-800' : 'border-gray-700 bg-gray-900'}
              ${digits[i] ? 'text-white' : 'text-gray-700'}`}>
              {digits[i] ?? '–'}
            </div>
          ))}
        </div>

        <p className="text-red-400 text-sm min-h-[1.25rem]">{error}</p>

        <div className="grid grid-cols-3 gap-3">
          {NUMS.map(n => (
            <button key={n} className={btnBase} onClick={() => press(n)}>{n}</button>
          ))}
          <button className={`${btnBase} text-gray-400 text-base`} onClick={clear} title="Очистить (Esc)">✕</button>
          <button className={btnBase} onClick={() => press('0')}>0</button>
          <button className={`${btnBase} text-gray-400 text-lg`} onClick={del} title="Удалить (Backspace)">⌫</button>
        </div>
      </div>
    </div>
  )
}

// ---------- TVPage ----------
export default function TVPage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [sessions, setSessions]   = useState<Record<number, Session>>({})
  const [logoMap, setLogoMap]     = useState<Record<string, string>>({})
  const [fetchedAt, setFetchedAt] = useState(Date.now())
  const [loading, setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [needPin, setNeedPin] = useState(() => !getTvParams())

  const clock = useClock()

  const load = useCallback(async () => {
    try {
      const ts = Date.now()
      const [instRes, sessions, devices] = await Promise.all([getInstances(), fetchTvSessions<Session[]>(), getDevices()])
      setInstances(instRes.data)
      setFetchedAt(ts)
      const map: Record<number, Session> = {}
      for (const s of sessions) map[s.instance_id] = s
      setSessions(map)
      setLogoMap(buildLogoMap(devices))
      setLastRefresh(new Date())
    } catch {
      setNeedPin(true)
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!needPin) load() }, [load, needPin])
  useEffect(() => {
    if (needPin) return
    const id = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [load, needPin])

  useEffect(() => {
    if (needPin) return
    const ch = echo.channel('instances')
    ch.listen('.ScheduleUpdated', () => load())
    return () => { echo.leave('instances') }
  }, [load, needPin])

  const handleExpire = useCallback((instanceId: number) => {
    setSessions(prev => { const n = { ...prev }; delete n[instanceId]; return n })
  }, [])

  const visible = instances.filter(inst => {
    const { type } = inst.schedule
    const isFree    = type === 'N/A' && inst.active
    const session   = sessions[inst.id]
    const isSession = type === 'IN_SESSION' || (!!session && session.status === 'ACTIVE')
    const isQueued  = !!session && session.status === 'QUEUE'
    return isFree || isSession || isQueued
  })

  const freeCount    = visible.filter(i => i.schedule.type === 'N/A').length
  const sessionCount = visible.filter(i => i.schedule.type === 'IN_SESSION' || sessions[i.id]?.status === 'ACTIVE').length
  const queueCount   = visible.filter(i => sessions[i.id]?.status === 'QUEUE').length

  const pad = (n: number) => String(n).padStart(2, '0')
  const clockStr = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`

  if (needPin) {
    return <PinScreen onSuccess={() => { setNeedPin(false); setLoading(true) }} />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col select-none">

      {/* Шапка */}
      <header className="px-6 py-3.5 flex items-center justify-between border-b border-gray-800/80 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎮</span>
          <span className="text-xl font-black tracking-tight text-white">Phober VR</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Свободно
              <span className="text-green-400 font-bold text-base">{freeCount}</span>
            </span>
            <span className="flex items-center gap-2 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              В сеансе
              <span className="text-orange-400 font-bold text-base">{sessionCount}</span>
            </span>
            {queueCount > 0 && (
              <span className="flex items-center gap-2 text-gray-500">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                В очереди
                <span className="text-yellow-400 font-bold text-base">{queueCount}</span>
              </span>
            )}
          </div>
          <span className="text-3xl font-mono font-black text-white tabular-nums">{clockStr}</span>
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 p-5 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-gray-900 animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-700 text-lg font-medium">
            Нет активных устройств
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visible.map(inst => {
              const session = sessions[inst.id] ?? null
              const isQueued  = session?.status === 'QUEUE'
              const isSession = !isQueued && (inst.schedule.type === 'IN_SESSION' || !!session)
              return isQueued
                ? <QueueCard   key={inst.id} inst={inst} session={session!} logo={logoMap[inst.device]} />
                : isSession
                  ? <SessionCard key={inst.id} inst={inst} session={session} fetchedAt={fetchedAt} logo={logoMap[inst.device]} onExpire={handleExpire} />
                  : <FreeCard    key={inst.id} inst={inst} logo={logoMap[inst.device]} />
            })}
          </div>
        )}
      </main>

      {/* Футер */}
      <footer className="px-6 py-2 border-t border-gray-800/60 flex items-center justify-end shrink-0">
        <span className="text-xs text-gray-700">
          обновлено {lastRefresh.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </footer>
    </div>
  )
}
