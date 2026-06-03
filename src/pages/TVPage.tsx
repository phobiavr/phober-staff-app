import { useCallback, useEffect, useRef, useState } from 'react'
import { Instance, getInstances, getDevices, buildLogoMap } from '../api/hardware'
import { fetchTvSessions, getTvParams, resolveTvPin } from '../api/tvClient'
import { Session } from '../api/sessions'
import { echo } from '../realtime/echo'

const DEVICE_ICONS: Record<string, string> = {
  PS_VR: '🥽', HTC: '🎮', OCULUS: '🥽', OMNI: '🏃', DOF_3: '💺', PC: '🖥️',
}

function DeviceIcon({ logo, type }: { logo?: string; type: string }) {
  if (logo) return <img src={logo} alt={type} className="w-7 h-7 object-contain opacity-80" />
  return <span className="text-2xl leading-none">{DEVICE_ICONS[type] ?? '🎮'}</span>
}

const REFRESH_INTERVAL = 30_000

// Один общий тик, выровненный по границе секунды на стенных часах
function useClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>
    function tick() {
      setNow(Date.now())
      id = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    id = setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => clearTimeout(id)
  }, [])
  return now
}

function pad(n: number) { return String(n).padStart(2, '0') }
function fmtSecs(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// ---------- SessionCard ----------
// now приходит сверху — все карточки тикают синхронно
function SessionCard({ inst, session, fetchedAt, logo, now, onExpire }: {
  inst: Instance
  session: Session | null
  fetchedAt: number
  logo?: string
  now: number
  onExpire: (id: number) => void
}) {
  const { countdown } = inst.schedule
  const sessionStart = session ? new Date(session.started_at ?? session.created_at).getTime() : null
  const endsAt = sessionStart
    ? sessionStart + session!.time * 60 * 1000
    : countdown > 0 ? fetchedAt + countdown * 1000 : null

  const totalSecs = session ? session.time * 60 : countdown > 0 ? countdown : 1
  const remaining = endsAt ? Math.max(0, Math.floor((endsAt - now) / 1000)) : 0
  const progress  = Math.min(1, (totalSecs - remaining) / totalSecs)
  const isLow     = remaining > 0 && remaining <= 60

  const firedRef = useRef(false)
  useEffect(() => {
    if (remaining === 0 && endsAt && endsAt <= now && !firedRef.current) {
      firedRef.current = true
      onExpire(inst.id)
    }
  }, [remaining])

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col bg-gray-900 min-h-56">
      {/* Цветная шапка — сразу виден статус */}
      <div className={`px-4 py-2.5 flex items-center justify-between shrink-0 ${isLow ? 'bg-red-600' : 'bg-blue-600'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full bg-white/80 shrink-0 ${isLow ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-bold uppercase tracking-widest text-white">В сеансе</span>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      {/* Устройство */}
      <div className="px-4 pt-3 shrink-0">
        <p className="text-sm font-semibold text-gray-400 truncate">{inst.label || inst.device}</p>
      </div>

      {/* Таймер */}
      <div className="flex-1 flex items-center justify-center py-2">
        <span className={`font-mono font-black tabular-nums leading-none text-6xl ${isLow ? 'text-red-300 animate-pulse' : 'text-white'}`}>
          {fmtSecs(remaining)}
        </span>
      </div>

      {/* Клиент */}
      {session?.customer && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-600 truncate">👤 {session.customer}</p>
        </div>
      )}

      {/* Прогресс */}
      <div className="h-1 bg-gray-800 shrink-0">
        <div
          className={`h-full ${isLow ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

// ---------- QueueCard ----------
function QueueCard({ inst, session, logo, now }: {
  inst: Instance
  session: Session
  logo?: string
  now: number
}) {
  const elapsed = Math.floor((now - new Date(session.created_at).getTime()) / 1000)

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col bg-gray-900 min-h-56">
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0 bg-amber-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-white">В очереди</span>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      <div className="px-4 pt-3 shrink-0">
        <p className="text-sm font-semibold text-gray-400 truncate">{inst.label || inst.device}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-2 gap-1">
        <span className="text-[10px] uppercase tracking-widest text-amber-500/70 font-medium">ожидает</span>
        <span className="font-mono font-black tabular-nums text-amber-300 text-6xl leading-none">
          {fmtSecs(elapsed)}
        </span>
        <span className="text-xs text-gray-700 mt-0.5">{session.time} мин забронировано</span>
      </div>

      {session.customer && (
        <div className="px-4 pb-2 shrink-0">
          <p className="text-xs text-gray-600 truncate">👤 {session.customer}</p>
        </div>
      )}

      <div className="h-1 bg-gray-800 shrink-0">
        <div className="h-full bg-amber-500" />
      </div>
    </div>
  )
}

// ---------- FreeCard ----------
function FreeCard({ inst, logo }: { inst: Instance; logo?: string }) {
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col bg-gray-900 min-h-56">
      <div className="px-4 py-2.5 flex items-center justify-between shrink-0 bg-emerald-600">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/80 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-white">Свободен</span>
        </div>
        <DeviceIcon logo={logo} type={inst.device} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-2">
        <p className="text-2xl font-black text-white text-center leading-tight truncate max-w-[16ch]">
          {inst.label || inst.device}
        </p>
        <p className="text-xs text-emerald-700 font-medium tracking-widest uppercase">готов к игре</p>
      </div>

      <div className="h-1 bg-emerald-600/30 shrink-0" />
    </div>
  )
}

// ---------- PinScreen ----------
function PinScreen({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState<string[]>([])
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  const press = (d: string) => { if (!busy) setDigits(prev => prev.length < 4 ? [...prev, d] : prev) }
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
  const btnBase = 'w-20 h-20 rounded-2xl border border-gray-700 bg-gray-900 text-white text-2xl font-bold flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:border-blue-500 hover:bg-gray-800 select-none'

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-10">
        <div className="text-center">
          <p className="text-2xl font-black text-white mb-1">Phober <span className="text-blue-400">VR</span></p>
          <p className="text-gray-500 text-sm uppercase tracking-widest">
            {busy ? 'Проверка...' : 'Введите PIN-код'}
          </p>
        </div>

        <div className="flex gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-4xl font-black transition-all
              ${busy ? 'border-blue-500 bg-blue-900/20' : i === digits.length && digits.length < 4 ? 'border-blue-500 bg-gray-900' : 'border-gray-800 bg-gray-900'}
              ${digits[i] ? 'text-white' : 'text-gray-800'}`}>
              {digits[i] ? '●' : ''}
            </div>
          ))}
        </div>

        <p className="text-red-400 text-sm min-h-[1.25rem]">{error}</p>

        <div className="grid grid-cols-3 gap-2.5">
          {NUMS.map(n => (
            <button key={n} className={btnBase} onClick={() => press(n)}>{n}</button>
          ))}
          <button className={`${btnBase} text-gray-500 text-sm`} onClick={clear}>CLR</button>
          <button className={btnBase} onClick={() => press('0')}>0</button>
          <button className={`${btnBase} text-gray-500 text-xl`} onClick={del}>⌫</button>
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

  const now = useClock()  // единственный источник времени для всей страницы

  const load = useCallback(async () => {
    try {
      const ts = Date.now()
      const [instRes, sessionList, devices] = await Promise.all([getInstances(), fetchTvSessions<Session[]>(), getDevices()])
      setInstances(instRes.data)
      setFetchedAt(ts)
      const map: Record<number, Session> = {}
      for (const s of sessionList) map[s.instance_id] = s
      setSessions(map)
      setLogoMap(buildLogoMap(devices))
      setLastRefresh(new Date())
    } catch {
      setNeedPin(true)
    } finally {
      setLoading(false)
    }
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
    const session  = sessions[inst.id]
    return (type === 'N/A' && inst.active) ||
           type === 'IN_SESSION' ||
           (!!session && (session.status === 'ACTIVE' || session.status === 'QUEUE'))
  })

  const freeCount    = visible.filter(i => i.schedule.type === 'N/A').length
  const sessionCount = visible.filter(i => i.schedule.type === 'IN_SESSION' || sessions[i.id]?.status === 'ACTIVE').length
  const queueCount   = visible.filter(i => sessions[i.id]?.status === 'QUEUE').length

  const d = new Date(now)
  const clockStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

  if (needPin) {
    return <PinScreen onSuccess={() => { setNeedPin(false); setLoading(true) }} />
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col select-none">

      {/* Шапка */}
      <header className="px-8 flex items-center justify-between border-b border-gray-800/80 bg-gray-900/50 backdrop-blur-sm shrink-0 h-16">
        <div className="flex items-center gap-2 w-48">
          <span className="text-xl">🎮</span>
          <span className="text-lg font-black tracking-tight text-white">
            Phober <span className="text-blue-400">VR</span>
          </span>
        </div>

        <span className="font-mono font-black text-white tabular-nums text-4xl tracking-wider">
          {clockStr}
        </span>

        <div className="flex items-center gap-2 w-48 justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/15 border border-emerald-600/30 text-emerald-400 text-sm font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" /> {freeCount}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/15 border border-blue-600/30 text-blue-400 text-sm font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" /> {sessionCount}
          </div>
          {queueCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-sm font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> {queueCount}
            </div>
          )}
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 p-5 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-gray-900 animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-700 text-lg font-medium">
            Нет активных устройств
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {visible.map(inst => {
              const session   = sessions[inst.id] ?? null
              const isQueued  = session?.status === 'QUEUE'
              const isSession = !isQueued && (inst.schedule.type === 'IN_SESSION' || !!session)
              return isQueued
                ? <QueueCard   key={inst.id} inst={inst} session={session!} logo={logoMap[inst.device]} now={now} />
                : isSession
                  ? <SessionCard key={inst.id} inst={inst} session={session} fetchedAt={fetchedAt} logo={logoMap[inst.device]} now={now} onExpire={handleExpire} />
                  : <FreeCard    key={inst.id} inst={inst} logo={logoMap[inst.device]} />
            })}
          </div>
        )}
      </main>

      {/* Футер */}
      <footer className="px-8 py-2 border-t border-gray-800/50 flex items-center justify-end shrink-0">
        <span className="text-xs text-gray-700">
          обновлено {lastRefresh.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </footer>
    </div>
  )
}
