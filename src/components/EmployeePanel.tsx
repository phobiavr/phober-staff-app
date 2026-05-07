import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Employee } from '../api/staff'

type Period = 'day' | 'week' | 'month'

const COLORS = ['#3b82f6', '#f97316', '#8b5cf6', '#10b981', '#f43f5e', '#06b6d4', '#eab308']

const fmtMins = (mins: number) => {
  if (mins < 60) return `${mins}м`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`
}

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
}

interface Props {
  employees: Employee[]
  loading: boolean
}

export default function EmployeePanel({ employees, loading }: Props) {
  const [period, setPeriod] = useState<Period>('day')

  const getCount = (e: Employee) => ({
    day:   e.serviced.in_a_day,
    week:  e.serviced.in_a_week,
    month: e.serviced.in_a_month,
  }[period])

  const getMins = (e: Employee) => ({
    day:   e.serviced.minutes_in_a_day,
    week:  e.serviced.minutes_in_a_week,
    month: e.serviced.minutes_in_a_month,
  }[period])

  const sorted = [...employees].sort((a, b) => getMins(b) - getMins(a))
  const totalMins = sorted.reduce((s, e) => s + getMins(e), 0)

  const pieData = sorted
    .filter(e => getMins(e) > 0)
    .map((e, i) => ({
      name: e.full_name,
      value: getMins(e),
      color: COLORS[i % COLORS.length],
    }))

  return (
    <div className="w-56 shrink-0 flex flex-col gap-3">

      {/* Заголовок + переключатель периода */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Сотрудники</h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-white dark:bg-gray-900 rounded-xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : (
        <>
          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [fmtMins(v), 'Время']}
                    contentStyle={{
                      fontSize: '11px',
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1">
                Итого: {fmtMins(totalMins)}
              </p>
            </div>
          )}

          {/* Список сотрудников */}
          <div className="space-y-1.5">
            {sorted.map((emp, i) => {
              const count = getCount(emp)
              const mins  = getMins(emp)
              const pct   = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0
              const color = COLORS[i % COLORS.length]

              return (
                <div
                  key={emp.id}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                        {emp.full_name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-1">
                      {count} сеанс{count === 1 ? '' : count < 5 ? 'а' : 'ов'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>

                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {fmtMins(mins)}
                    {pct > 0 && <span className="ml-1 text-gray-300 dark:text-gray-600">· {pct}%</span>}
                  </p>
                </div>
              )
            })}

            {sorted.length === 0 && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-600 py-4">
                Нет данных
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
