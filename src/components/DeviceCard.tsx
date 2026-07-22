import { useCallback, useEffect, useState } from 'react'
import { Instance } from '../api/hardware'
import { Session } from '../api/sessions'
import SessionTimer from './SessionTimer'

export const DEVICE_ICONS: Record<string, string> = {
  PS_VR: '🥽',
  HTC: '🎮',
  OCULUS: '🥽',
  PC: '🖥️',
}

export function DeviceIcon({ logo, type }: { logo?: string; type: string }) {
  if (logo) return <img src={logo} alt={type} className="w-5 h-5 object-contain" />
  return <span className="text-base leading-none">{DEVICE_ICONS[type] ?? '🎮'}</span>
}

function WaitTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - new Date(since).getTime()) / 1000))
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(since).getTime()) / 1000)), 1000)
    return () => clearInterval(id)
  }, [since])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="font-mono font-bold text-2xl tabular-nums text-amber-500 dark:text-amber-400">
      {pad(m)}:{pad(s)}
    </span>
  )
}

interface StatusStyle {
  label: string
  border: string
  badge: string
}

export const STATUS_STYLES: Record<string, StatusStyle> = {
  IN_SESSION:  { label: 'В сеансе',     border: 'border-l-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'       },
  QUEUE:       { label: 'Ожидание',     border: 'border-l-amber-500',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'   },
  MAINTENANCE: { label: 'Обслуживание', border: 'border-l-gray-400',    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'          },
  RESERVATION: { label: 'Бронь',        border: 'border-l-violet-500',  badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400' },
  INSPECTION:  { label: 'Осмотр',       border: 'border-l-yellow-500',  badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' },
  REPAIR:      { label: 'Ремонт',       border: 'border-l-red-500',     badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'           },
  ON_EVENT:    { label: 'Мероприятие',  border: 'border-l-purple-500',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
  'N/A':       { label: 'Свободен',     border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  UPCOMING:    { label: 'Скоро занят',  border: 'border-l-orange-400',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
}

interface Props {
  instance: Instance
  session: Session | null
  fetchedAt: number
  logo?: string
  onStart: (instance: Instance) => void
  onStartSession: (session: Session) => void
  onCancelSession: (session: Session) => void
  onFinish: (session: Session) => void
  onExpire: (instanceId: number) => void
  onInfo: (instance: Instance) => void
}

export default function DeviceCard({ instance, session, fetchedAt, logo, onStart, onStartSession, onCancelSession, onFinish, onExpire, onInfo }: Props) {
  const { type, countdown } = instance.schedule
  const upcoming            = instance.upcoming_schedule
  const isDisabled  = !instance.active
  const isQueued    = session?.status === 'QUEUE'
  const isActive    = (!isQueued && session !== null) || type === 'IN_SESSION'
  const isSession   = isQueued || isActive
  const isUpcoming  = !isSession && !isDisabled && !!upcoming && upcoming.starts_in > 0
  const isFree      = !isSession && !isUpcoming && type === 'N/A' && !isDisabled

  const currentType = isQueued ? 'QUEUE' : isActive ? 'IN_SESSION' : isUpcoming ? 'UPCOMING' : type
  const style = STATUS_STYLES[currentType] ?? STATUS_STYLES['N/A']

  const sessionEndsAt    = isActive && session
    ? new Date(session.started_at ?? session.created_at).getTime() + session.time * 60 * 1000
    : null
  const scheduleEndsAt   = !isQueued && countdown > 0 ? fetchedAt + countdown * 1000 : null
  const upcomingStartsAt = isUpcoming && upcoming ? fetchedAt + upcoming.starts_in * 1000 : null
  const endsAt = sessionEndsAt ?? scheduleEndsAt

  const handleExpire = useCallback(() => onExpire(instance.id), [instance.id, onExpire])

  return (
    <div className={`
      rounded-xl bg-white dark:bg-gray-900
      border border-gray-100 dark:border-gray-800 border-l-4 ${style.border}
      flex flex-col h-48 transition-shadow
      ${isDisabled ? 'opacity-40' : ''}
      ${isFree ? 'hover:shadow-md' : ''}
    `}>

      {/* Шапка: иконка + название + статус-бейдж */}
      <div className="px-3 pt-3 flex items-start justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <DeviceIcon logo={logo} type={instance.device} />
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
            {instance.label || instance.device}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {style.label}
          </span>
          <button
            onClick={() => onInfo(instance)}
            title="Информация об устройстве"
            className="w-4 h-4 flex items-center justify-center rounded-full text-[10px] leading-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ⓘ
          </button>
        </div>
      </div>

      {/* Центр: таймер + инфо */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 gap-1 min-h-0">
        {isQueued && session && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">ожидает</span>
            <WaitTimer since={session.created_at} />
          </div>
        )}
        {!isQueued && isSession && sessionEndsAt !== null && (
          <SessionTimer endsAt={sessionEndsAt} onExpire={handleExpire} />
        )}
        {isSession && session && (session.customer || session.serviced_by_name) && (
          <div className="text-center mt-0.5 space-y-0.5">
            {session.customer && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[14ch]">
                👤 {session.customer}
              </p>
            )}
            {session.serviced_by_name && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[14ch]">
                🧑‍💼 {session.serviced_by_name}
              </p>
            )}
          </div>
        )}
        {!isSession && !isFree && scheduleEndsAt !== null && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">освободится через</span>
            <SessionTimer
              endsAt={scheduleEndsAt}
              onExpire={handleExpire}
              className="text-gray-600 dark:text-gray-400"
            />
          </div>
        )}
        {isUpcoming && upcomingStartsAt !== null && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-orange-500 dark:text-orange-400">начнётся через</span>
            <SessionTimer
              endsAt={upcomingStartsAt}
              onExpire={handleExpire}
              className="text-orange-500 dark:text-orange-400"
            />
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {upcoming ? (STATUS_STYLES[upcoming.type]?.label ?? upcoming.type) : null}
            </span>
          </div>
        )}
      </div>

      {/* Кнопки */}
      <div className="px-3 pb-3 shrink-0">
        {isQueued && session ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => onCancelSession(session)}
              className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => onStartSession(session)}
              className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
            >
              Старт
            </button>
          </div>
        ) : isActive && session ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => onCancelSession(session)}
              className="flex-1 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => onFinish(session)}
              className="flex-1 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border border-red-100 dark:border-red-900/30"
            >
              Завершить
            </button>
          </div>
        ) : isFree ? (
          <button
            onClick={() => onStart(instance)}
            className="w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Начать сеанс
          </button>
        ) : isUpcoming ? (
          <p className="text-center text-xs text-orange-500 dark:text-orange-400 py-1 font-medium">
            Бронирование недоступно
          </p>
        ) : (
          <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-1">
            {isDisabled ? 'Отключено' : 'Недоступно'}
          </p>
        )}
      </div>
    </div>
  )
}
