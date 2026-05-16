import { useCallback, useEffect, useState } from 'react'
import { Instance } from '../api/hardware'
import { Session } from '../api/sessions'
import SessionTimer from './SessionTimer'

const DEVICE_ICONS: Record<string, string> = {
  PS_VR: '🥽',
  HTC: '🎮',
  OCULUS: '🥽',
  PC: '🖥️',
}

function DeviceIcon({ logo, type, className }: { logo?: string; type: string; className?: string }) {
  if (logo) return <img src={logo} alt={type} className={className ?? 'w-5 h-5 object-contain'} />
  return <span className="text-lg leading-none">{DEVICE_ICONS[type] ?? '🎮'}</span>
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
    <span className="font-mono font-bold text-lg tabular-nums text-yellow-500">
      {pad(m)}:{pad(s)}
    </span>
  )
}

interface StatusStyle {
  label: string
  strip: string
  text: string
}

const STATUS_STYLES: Record<string, StatusStyle> = {
  IN_SESSION:  { label: 'В сеансе',     strip: 'bg-orange-100 dark:bg-orange-900/40',  text: 'text-orange-600 dark:text-orange-400'  },
  QUEUE:       { label: 'Ожидание',     strip: 'bg-yellow-100 dark:bg-yellow-900/40',  text: 'text-yellow-600 dark:text-yellow-400'  },
  MAINTENANCE: { label: 'Обслуживание', strip: 'bg-gray-100 dark:bg-gray-800',          text: 'text-gray-500 dark:text-gray-400'       },
  RESERVATION: { label: 'Бронь',        strip: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-600 dark:text-blue-400'       },
  INSPECTION:  { label: 'Осмотр',       strip: 'bg-yellow-100 dark:bg-yellow-900/40',   text: 'text-yellow-600 dark:text-yellow-400'   },
  REPAIR:      { label: 'Ремонт',       strip: 'bg-red-100 dark:bg-red-900/40',         text: 'text-red-600 dark:text-red-400'         },
  ON_EVENT:    { label: 'Мероприятие',  strip: 'bg-purple-100 dark:bg-purple-900/40',   text: 'text-purple-600 dark:text-purple-400'   },
  'N/A':       { label: 'Свободен',     strip: 'bg-green-100 dark:bg-green-900/40',     text: 'text-green-600 dark:text-green-400'     },
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
}

export default function DeviceCard({ instance, session, fetchedAt, logo, onStart, onStartSession, onCancelSession, onFinish, onExpire }: Props) {
  const { type, countdown } = instance.schedule
  const isDisabled = !instance.active
  const isQueued = session?.status === 'QUEUE'
  const isActive = (!isQueued && session !== null) || type === 'IN_SESSION'
  const isSession = isQueued || isActive
  const isFree = !isSession && type === 'N/A' && !isDisabled

  const currentType = isQueued ? 'QUEUE' : isActive ? 'IN_SESSION' : type
  const style = STATUS_STYLES[currentType] ?? STATUS_STYLES['N/A']

  const endsAt = isActive && session
    ? new Date(session.started_at ?? session.created_at).getTime() + session.time * 60 * 1000
    : !isQueued && countdown > 0 ? fetchedAt + countdown * 1000 : null

  const handleExpire = useCallback(() => onExpire(instance.id), [instance.id, onExpire])

  return (
    <div className={`rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900
      flex flex-col h-48 transition-all
      ${isDisabled ? 'opacity-40' : ''}
      ${isFree ? 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700' : ''}
    `}>

      {/* Цветная шапка */}
      <div className={`${style.strip} px-3 py-2.5 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2">
          <DeviceIcon logo={logo} type={instance.device} />
          <span className={`text-xs font-semibold ${style.text}`}>{style.label}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">#{instance.id}</span>
      </div>

      {/* Тело карточки */}
      <div className="flex flex-col flex-1 min-h-0 px-3 py-2.5">

        {/* Название */}
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight truncate">
          {instance.label || instance.device}
        </p>

        {/* Центр: таймер или пустота */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {isQueued && session && (
            <div className="flex flex-col items-center gap-0.5">
              <WaitTimer since={session.created_at} />
            </div>
          )}
          {!isQueued && isSession && endsAt !== null && (
            <SessionTimer endsAt={endsAt} onExpire={handleExpire} />
          )}
          {isSession && session && (session.customer || session.serviced_by_name) && (
            <div className="w-full mt-1 space-y-2">
              {session.customer && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate text-center">
                  👤 {session.customer}
                </p>
              )}
              {session.serviced_by_name && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate text-center mb-1">
                  🧑‍💼 {session.serviced_by_name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Кнопка всегда внизу */}
        {isQueued && session ? (
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => onCancelSession(session)}
              className="flex-1 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => onStartSession(session)}
              className="flex-1 py-1.5 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              Старт
            </button>
          </div>
        ) : isActive && session ? (
          <button
            onClick={() => onFinish(session)}
            className="w-full py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
          >
            Завершить
          </button>
        ) : isFree ? (
          <button
            onClick={() => onStart(instance)}
            className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0"
          >
            Начать сеанс
          </button>
        ) : (
          <p className="text-center text-xs text-gray-400 dark:text-gray-600 py-1.5 shrink-0">
            {isDisabled ? 'Отключено' : 'Недоступно'}
          </p>
        )}

      </div>
    </div>
  )
}
