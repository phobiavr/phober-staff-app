import { useCallback, useEffect, useRef, useState } from 'react'
import { Instance, getInstances, getDevices, buildLogoMap } from '../api/hardware'
import { EXPIRE_REFETCH_DELAY } from '../config'
import { Session, CreateSessionParams, createSession, startSession, cancelSession, finishSession, getSessions } from '../api/sessions'
import { Employee, getEmployees } from '../api/staff'
import { Invoice, getOpenInvoices } from '../api/invoices'
import { TariffPlan, getTariffPlans } from '../api/tariffs'
import DeviceCard from '../components/DeviceCard'
import EmployeePanel from '../components/EmployeePanel'
import StartSessionModal from '../components/StartSessionModal'
import { echo } from '../realtime/echo'
import { useTvPin } from '../contexts/TvPinContext'

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>([])
  const [sessions, setSessions] = useState<Record<number, Session>>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tariffPlans, setTariffPlans] = useState<TariffPlan[]>([])
  const [logoMap, setLogoMap] = useState<Record<string, string>>({})
  const [staffCollapsed, setStaffCollapsed] = useState(
    () => localStorage.getItem('staff-panel-collapsed') === 'true'
  )
  const toggleStaff = () => setStaffCollapsed(prev => {
    localStorage.setItem('staff-panel-collapsed', String(!prev))
    return !prev
  })
  const [fetchedAt, setFetchedAt] = useState<number>(Date.now())
  const [loading, setLoading] = useState(true)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null)

  useEffect(() => {
    const ts = Date.now()
    Promise.all([getInstances(), getSessions(), getDevices(), getOpenInvoices(), getTariffPlans()])
      .then(([instancesRes, sessionsRes, devices, invs, plans]) => {
        setInstances(instancesRes.data)
        setFetchedAt(ts)
        const map: Record<number, Session> = {}
        for (const s of sessionsRes.data) map[s.instance_id] = s
        setSessions(map)
        setLogoMap(buildLogoMap(devices))
        setInvoices(invs)
        setTariffPlans(plans)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    getEmployees()
      .then(res => setEmployees(res.data))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false))
  }, [])

  const refresh = useCallback(() =>
    Promise.all([getInstances(), getSessions()])
      .then(([instancesRes, sessionsRes]) => {
        setInstances(instancesRes.data)
        setFetchedAt(Date.now())
        const map: Record<number, Session> = {}
        for (const s of sessionsRes.data) map[s.instance_id] = s
        setSessions(map)
      })
      .catch(() => {}),
    []
  )

  useEffect(() => {
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
  }, [refresh])

  const refreshEmployees = async () => {
    const res = await getEmployees()
    setEmployees(res.data)
  }

  const refreshInvoices = async () => {
    const invs = await getOpenInvoices()
    setInvoices(invs)
  }

  const handleStartConfirm = async (params: Omit<CreateSessionParams, 'instance_id'>) => {
    if (!selectedInstance) return
    const inst = selectedInstance
    try {
      const { data: session } = await createSession({ ...params, instance_id: inst.id })
      setSessions(prev => ({ ...prev, [inst.id]: session }))
      setFetchedAt(Date.now())
      setSelectedInstance(null)
      refresh()
      refreshEmployees()
      refreshInvoices()
    } catch {
      // модалка остаётся открытой — тост об ошибке уже показан axios-интерцептором
    }
  }

  const handleStartSession = async (session: Session) => {
    try {
      const { data: updated } = await startSession(session.id)
      setSessions(prev => ({ ...prev, [session.instance_id]: updated }))
      setFetchedAt(Date.now())
      refresh()
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
      refresh()
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
      refresh()
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
    setTimeout(() => {
      refresh()
      refreshEmployees()
    }, EXPIRE_REFETCH_DELAY)
  }, [refresh])

  const { tvPin } = useTvPin()

  const freeCount    = instances.filter(i => i.schedule.type === 'N/A' && i.active).length
  const sessionCount = instances.filter(i => i.schedule.type === 'IN_SESSION').length
  const queueCount   = Object.values(sessions).filter(s => s.status === 'QUEUE').length
  const otherCount   = instances.filter(i => !['N/A', 'IN_SESSION'].includes(i.schedule.type) || !i.active).length

  return (
    <div className="flex h-full">

      {/* Центр: устройства */}
      <div className="flex-1 min-w-0 px-4 py-5">

        {/* Шапка */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Устройства</h1>
          {!loading && (
            <div className="flex flex-wrap gap-1.5 text-xs items-center">
              <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium border border-green-100 dark:border-green-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                Свободно {freeCount}
              </span>
              <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-full font-medium border border-blue-100 dark:border-blue-900/40">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                В сеансе {sessionCount}
              </span>
              {queueCount > 0 && (
                <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full font-medium border border-amber-100 dark:border-amber-900/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  Очередь {queueCount}
                </span>
              )}
              {otherCount > 0 && (
                <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-full font-medium border border-gray-200 dark:border-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                  Прочее {otherCount}
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

      {/* Правая панель: сотрудники */}
      <div className={`hidden lg:flex flex-col shrink-0 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 ${staffCollapsed ? 'w-10' : 'w-60'}`}>
        {/* Кнопка коллапса */}
        <button
          onClick={toggleStaff}
          className={`shrink-0 flex items-center py-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-sm font-medium ${staffCollapsed ? 'justify-center px-2' : 'gap-2 px-3'}`}
          title={staffCollapsed ? 'Развернуть сотрудников' : 'Свернуть'}
        >
          <span className="text-base leading-none">{staffCollapsed ? '‹' : '›'}</span>
          {!staffCollapsed && <span className="text-xs text-gray-400">Сотрудники</span>}
        </button>

        {!staffCollapsed && (
          <div className="flex-1 overflow-y-auto px-3 pb-5">
            <EmployeePanel employees={employees} loading={employeesLoading} />
          </div>
        )}
      </div>

      {selectedInstance && (
        <StartSessionModal
          instance={selectedInstance}
          employees={employees}
          employeesLoading={employeesLoading}
          invoices={invoices}
          tariffPlans={tariffPlans}
          onConfirm={handleStartConfirm}
          onClose={() => setSelectedInstance(null)}
        />
      )}
    </div>
  )
}
