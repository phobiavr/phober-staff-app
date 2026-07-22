import { useEffect } from 'react'
import { Instance } from '../api/hardware'
import { Session } from '../api/sessions'
import { DeviceIcon, STATUS_STYLES } from './DeviceCard'

interface Props {
  instance: Instance
  session: Session | null
  logo?: string
  onClose: () => void
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const SESSION_STATUS_LABELS: Record<string, string> = {
  ACTIVE:   'Активен',
  FINISHED: 'Завершён',
  CANCELED: 'Отменён',
  QUEUE:    'Ожидание',
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`text-sm text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export default function InstanceInfoModal({ instance, session, logo, onClose }: Props) {
  const currentType = instance.schedule?.type ?? 'N/A'
  const statusStyle = STATUS_STYLES[currentType] ?? STATUS_STYLES['N/A']

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5">

          {/* Шапка */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <DeviceIcon logo={logo} type={instance.device} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {instance.label || instance.device}
                </h2>
                <p className="text-xs text-gray-400 dark:text-gray-500">#{instance.id}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Основные данные */}
          <div className="mb-3">
            <InfoRow label="Тип устройства" value={instance.device} />
            <InfoRow label="MAC-адрес" value={instance.mac_address ?? '—'} mono />
            <InfoRow
              label="Доступность"
              value={instance.active ? 'Активно' : 'Отключено'}
            />
            <InfoRow label="Текущее состояние" value={statusStyle.label} />
            <InfoRow label="Зарегистрировано" value={fmtDate(instance.created_at)} />
          </div>

          {/* Текущее расписание */}
          {currentType !== 'N/A' && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Текущее расписание</p>
              {instance.schedule?.start && <InfoRow label="Начало" value={fmtDate(instance.schedule.start)} />}
              {instance.schedule?.end ? (
                <InfoRow label="Окончание" value={fmtDate(instance.schedule.end)} />
              ) : instance.schedule?.countdown === -1 ? (
                <InfoRow label="Окончание" value="без ограничения по времени" />
              ) : null}
            </div>
          )}

          {/* Ближайшее событие */}
          {instance.upcoming_schedule && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ближайшее событие</p>
              <InfoRow
                label={STATUS_STYLES[instance.upcoming_schedule.type]?.label ?? instance.upcoming_schedule.type}
                value={`через ${Math.max(0, Math.round(instance.upcoming_schedule.starts_in / 60))} мин`}
              />
            </div>
          )}

          {/* Текущий сеанс */}
          {session && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Текущий сеанс</p>
              <InfoRow label="ID сеанса" value={`#${session.id}`} />
              <InfoRow label="Статус" value={SESSION_STATUS_LABELS[session.status] ?? session.status} />
              <InfoRow label="Длительность" value={`${session.time} мин`} />
              {session.serviced_by_name && <InfoRow label="Сотрудник" value={session.serviced_by_name} />}
              {session.customer && <InfoRow label="Клиент" value={session.customer} />}
              <InfoRow label="Создан" value={fmtDate(session.created_at)} />
              {session.started_at && <InfoRow label="Начат" value={fmtDate(session.started_at)} />}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
