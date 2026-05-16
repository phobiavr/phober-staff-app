import { useCallback, useEffect, useRef, useState } from 'react'
import { Instance, getInstances, getDevices, buildLogoMap } from '../api/hardware'
import { Session, CreateSessionParams, createSession, startSession, cancelSession, finishSession, getSessions } from '../api/sessions'
import { Employee, getEmployees } from '../api/staff'
import DeviceCard from '../components/DeviceCard'
import EmployeePanel from '../components/EmployeePanel'
import StartSessionModal from '../components/StartSessionModal'
import { echo } from '../realtime/echo'

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [sessions, setSessions] = useState<Record<number, Session>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [logoMap, setLogoMap] = useState<Record<string, string>>({})
  const [fetchedAt, setFetchedAt] = useState<number>(Date.now())
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)

  useEffect(() => {
    const ts = Date.now()
    Promise.all([getInstances(), getSessions(), getDevices()])
      .then(([instancesRes, sessionsRes, devices]) => {
        setInstances(instancesRes.data)
        setFetchedAt(ts)
        const map: Record<number, Session> = {}
        for (const s of sessionsRes.data) map[s.instance_id] = s
        setSessions(map)
        setLogoMap(buildLogoMap(devices))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    getEmployees()
      .then(res => setEmployees(res.data))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false))
  }, [])

  useEffect(() => {
    const refresh = () =>
      Promise.all([getInstances(), getSessions()])
        .then(([instancesRes, sessionsRes]) => {
          setInstances(instancesRes.data)
          setFetchedAt(Date.now())
          const map: Record<number, Session> = {}
          for (const s of sessionsRes.data) map[s.instance_id] = s
          setSessions(map)
        })
        .catch(() => {})

    const sessionsCh = echo.private('sessions')
    sessionsCh.subscribed(() => console.log('[ws] subscribed sessions'))
    sessionsCh.error((err: unknown) => console.error('[ws] channel error', err))
    sessionsCh.listen('.SessionCreated', (e: { session_id: number; instance_id: number }) => {
      console.log('[ws] SessionCreated', e)
      refresh()
    })

    const instancesCh = echo.private('instances')
    instancesCh.subscribed(() => console.log('[ws] subscribed instances'))
    instancesCh.error((err: unknown) => console.error('[ws] channel error', err))
    instancesCh.listen('.ScheduleUpdated', (e: { schedule_id: number; instance_id: number; action: string }) => {
      console.log('[ws] ScheduleUpdated', e)
      refresh()
    })

    return () => {
      echo.leave('sessions')
      echo.leave('instances')
    }
  }, [])

  const refreshInstances = async () => {
    const ts = Date.now()
    const res = await getInstances()
    setInstances(res.data)
    setFetchedAt(ts)
  }

  const refreshEmployees = async () => {
    const res = await getEmployees()
    setEmployees(res.data)
  }

  const handleStartConfirm = async (params: Omit<CreateSessionParams, 'instance_id'>) => {
    if (!selectedInstance) return
    const inst = selectedInstance
    setSelectedInstance(null)
    try {
      const { data: session } = await createSession({ ...params, instance_id: inst.id })
      setSessions(prev => ({ ...prev, [inst.id]: session }))
      setFetchedAt(Date.now())
      refreshInstances()
      refreshEmployees()
    } catch {}
  }

  const handleStartSession = async (session: Session) => {
    try {
      const { data: updated } = await startSession(session.id)
      setSessions(prev => ({ ...prev, [session.instance_id]: updated }))
      setFetchedAt(Date.now())
      refreshInstances()
    } catch {}
  }

  const handleCancelSession = async (session: Session) => {
    setSessions(prev => {
      const next = { ...prev }
      delete next[session.instance_id]
      return next
    })
    try {
      await cancelSession(session.id)
    } finally {
      refreshInstances()
      refreshEmployees()
    }
  }

  const handleFinish = async (session: Session) => {
    setSessions(prev => {
      const next = { ...prev }
      delete next[session.instance_id]
      return next
    })
    try {
      await finishSession(session.id)
    } finally {
      refreshInstances()
      refreshEmployees()
    }
  }

  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  const handleExpire = useCallback(async (instanceId: number) => {
    const session = sessionsRef.current[instanceId]
    setSessions(prev => {
      const next = { ...prev }
      delete next[instanceId]
      return next
    })
    if (session) {
      try { await finishSession(session.id) } catch {}
    }
    refreshInstances()
    refreshEmployees()
  }, [])

  const freeCount    = instances.filter(i => i.schedule.type === 'N/A' && i.active).length
  const sessionCount = instances.filter(i => i.schedule.type === 'IN_SESSION').length
  const queueCount   = Object.values(sessions).filter(s => s.status === 'QUEUE').length
  const otherCount   = instances.filter(i => !['N/A', 'IN_SESSION'].includes(i.schedule.type) || !i.active).length

  return (
    <div className="px-4 py-5 flex gap-4 items-start">

      {/* Левая панель: сотрудники */}
      <EmployeePanel employees={employees} loading={employeesLoading} />

      {/* Правая часть: устройства */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Устройства</h1>
            {!loading && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{instances.length} устройств</p>}
          </div>
          {!loading && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Свободно: {freeCount}
              </span>
              <span className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-2.5 py-1 rounded-full font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                В сеансе: {sessionCount}
              </span>
              {queueCount > 0 && (
                <span className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2.5 py-1 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 inline-block" />
                  В ожидании: {queueCount}
                </span>
              )}
              {otherCount > 0 && (
                <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2.5 py-1 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
                  Прочее: {otherCount}
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl h-48 animate-pulse border border-gray-100 dark:border-gray-800" />
            ))}
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600">
            <div className="text-4xl mb-3">🎮</div>
            <p className="font-medium">Устройства не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {instances.map(instance => (
              <DeviceCard
                key={instance.id}
                instance={instance}
                session={sessions[instance.id] ?? null}
                fetchedAt={fetchedAt}
                logo={logoMap[instance.device]}
                onStart={setSelectedInstance}
                onStartSession={handleStartSession}
                onCancelSession={handleCancelSession}
                onFinish={handleFinish}
                onExpire={handleExpire}
              />
            ))}
          </div>
        )}
      </div>

      {selectedInstance && (
        <StartSessionModal
          instance={selectedInstance}
          onConfirm={handleStartConfirm}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  )
}
