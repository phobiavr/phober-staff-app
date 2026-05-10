import { useEffect, useState } from 'react'
import { Session, getTodaySessions } from '../api/sessions'
import { Instance, getInstances } from '../api/hardware'
import { echo } from '../realtime/echo'

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: 'Активен',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  QUEUE:    { label: 'В очереди', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'         },
  FINISHED: { label: 'Завершён',  cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'     },
  CANCELED: { label: 'Отменён',   cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'            },
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [instances, setInstances] = useState<Record<number, Instance>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getTodaySessions(), getInstances()])
      .then(([sessRes, instRes]) => {
        setSessions(sessRes.data)
        const map: Record<number, Instance> = {}
        for (const i of instRes.data) map[i.id] = i
        setInstances(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const ch = echo.channel('instances')
    ch.listen('.SessionCreated', (e: { session_id: number; instance_id: number }) => {
      getTodaySessions().then(res => setSessions(res.data)).catch(() => {})
    })
    return () => { echo.leave('instances') }
  }, [])

  const total    = sessions.length
  const active   = sessions.filter(s => s.status === 'ACTIVE').length
  const finished = sessions.filter(s => s.status === 'FINISHED').length

  return (
    <div className="px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Сеансы за сегодня</h1>
        {!loading && (
          <div className="flex gap-2 mt-2 text-xs flex-wrap">
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-full font-medium">Всего: {total}</span>
            <span className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full font-medium">Активных: {active}</span>
            <span className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">Завершено: {finished}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-medium">Сеансов сегодня ещё не было</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => {
            const instance = instances[session.instance_id]
            const statusStyle = STATUS_STYLE[session.status] ?? STATUS_STYLE['CANCELED']
            const endsAt = new Date(new Date(session.created_at).getTime() + session.time * 60 * 1000)

            return (
              <div key={session.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
                <div className="shrink-0 text-center w-12">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{fmt(session.created_at)}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{session.time} мин</p>
                </div>

                <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 shrink-0" />

                <div className="shrink-0 w-28">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {instance?.label ?? `#${session.instance_id}`}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">до {fmt(endsAt.toISOString())}</p>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{session.customer ?? '—'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{session.serviced_by_name ?? '—'}</p>
                </div>

                <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle.cls}`}>
                  {statusStyle.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
