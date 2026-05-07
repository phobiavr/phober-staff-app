import { useEffect, useState } from 'react'
import { TariffPlan, TariffType, getTariffPlans, getCurrentTariff, TIME_MINS } from '../api/tariffs'
import { getDevices, buildLogoMap } from '../api/hardware'

const TARIFF_STYLE: Record<TariffType, { label: string; cls: string; dot: string }> = {
  MORNING: { label: 'Утренний', cls: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',   dot: 'bg-yellow-400' },
  EVENING: { label: 'Вечерний', cls: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',   dot: 'bg-indigo-500' },
  EXTRA:   { label: 'Особый',   cls: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',   dot: 'bg-purple-500' },
}

const DEVICE_ICONS: Record<string, string> = {
  PS_VR: '🥽', HTC: '🎮', OCULUS: '🥽', OMNI: '🏃', DOF_3: '💺', PC: '🖥️',
}

const TIME_LABELS: Record<string, string> = {
  MIN_15: '15 мин', MIN_30: '30 мин', MIN_60: '1 час',
}

export default function TariffsPage() {
  const [plans, setPlans]     = useState<TariffPlan[]>([])
  const [logoMap, setLogoMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const currentTariff = getCurrentTariff()

  useEffect(() => {
    Promise.all([getTariffPlans(), getDevices()])
      .then(([p, devices]) => { setPlans(p); setLogoMap(buildLogoMap(devices)) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Группируем: device → tariff → time → price
  const devices  = [...new Set(plans.map(p => p.device))].sort()
  const tariffs  = [...new Set(plans.map(p => p.tariff))] as TariffType[]
  const times    = ['MIN_15', 'MIN_30', 'MIN_60'] as const

  const getPrice = (device: string, tariff: TariffType, time: string) =>
    plans.find(p => p.device === device && p.tariff === tariff && p.time === time)?.price ?? null

  // Расчёт цены за минуту
  const pricePerMin = (price: number, time: string) => {
    const mins = TIME_MINS[time as keyof typeof TIME_MINS]
    return mins ? (price / mins).toFixed(1) : null
  }

  return (
    <div className="px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Тарифы</h1>
          {!loading && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {devices.length} устройств · {plans.length} тарифных позиций
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Сейчас активен:</span>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${TARIFF_STYLE[currentTariff].cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${TARIFF_STYLE[currentTariff].dot}`} />
            {TARIFF_STYLE[currentTariff].label}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white dark:bg-gray-900 rounded-2xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <div className="text-4xl mb-3">💰</div>
          <p className="font-medium">Тарифные планы не найдены</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map(device => (
            <div key={device} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
              {/* Заголовок устройства */}
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                {logoMap[device]
                  ? <img src={logoMap[device]} alt={device} className="w-6 h-6 object-contain" />
                  : <span className="text-xl">{DEVICE_ICONS[device] ?? '🎮'}</span>
                }
                <span className="font-semibold text-gray-900 dark:text-gray-100">{device}</span>
              </div>

              {/* Таблица тарифов */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide w-32">
                        Тариф
                      </th>
                      {times.map(t => (
                        <th key={t} className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                          {TIME_LABELS[t]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tariffs
                      .filter(tariff => times.some(t => getPrice(device, tariff, t) !== null))
                      .map(tariff => {
                        const st = TARIFF_STYLE[tariff]
                        const isActive = tariff === currentTariff
                        return (
                          <tr
                            key={tariff}
                            className={`border-b border-gray-50 dark:border-gray-800 last:border-0 transition-colors ${
                              isActive ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${st.cls}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                  {st.label}
                                </span>
                                {isActive && (
                                  <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">сейчас</span>
                                )}
                              </div>
                            </td>
                            {times.map(t => {
                              const price = getPrice(device, tariff, t)
                              return (
                                <td key={t} className="px-4 py-3 text-center">
                                  {price !== null ? (
                                    <div>
                                      <p className={`text-sm font-bold ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                        {price} AZN
                                      </p>
                                      <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {pricePerMin(price, t)} AZN/мин
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-700">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
