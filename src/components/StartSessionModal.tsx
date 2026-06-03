import { useEffect, useRef, useState } from 'react'
import { Instance } from '../api/hardware'
import { SessionTime, CreateSessionParams } from '../api/sessions'
import { Employee } from '../api/staff'
import { Customer, searchCustomers } from '../api/crm'
import { Invoice } from '../api/invoices'
import { TariffPlan, TariffType, getCurrentTariff } from '../api/tariffs'

const TIME_OPTIONS: { label: string; value: SessionTime }[] = [
  { label: '15 мин', value: 'MIN_15' },
  { label: '30 мин', value: 'MIN_30' },
  { label: '1 час',  value: 'MIN_60' },
]

const TARIFF_LABELS: Record<TariffType, string> = {
  MORNING: 'Утренний',
  EVENING: 'Вечерний',
  EXTRA:   'Особый',
}

interface Props {
  instance: Instance
  employees: Employee[]
  employeesLoading: boolean
  invoices: Invoice[]
  tariffPlans: TariffPlan[]
  onConfirm: (params: Omit<CreateSessionParams, 'instance_id'>) => void
  onClose: () => void
}

const selectCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all'

export default function StartSessionModal({ instance, employees, employeesLoading, invoices, tariffPlans, onConfirm, onClose }: Props) {
  const [time, setTime] = useState<SessionTime>('MIN_15')

  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    () => employees.length > 0 ? String(employees[0].id) : ''
  )

  const [selectedInvoice, setSelectedInvoice] = useState<string>('')

  const [currentTariff] = useState<TariffType>(getCurrentTariff)

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (customerSearch.trim().length < 2) {
      setCustomerResults([])
      setShowDropdown(false)
      return
    }
    setCustomerLoading(true)
    debounceRef.current = setTimeout(() => {
      searchCustomers(customerSearch.trim())
        .then(data => { setCustomerResults(data); setShowDropdown(true) })
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerLoading(false))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [customerSearch])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c)
    setCustomerSearch(c.full_name)
    setShowDropdown(false)
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerSearch('')
  }

  const handleConfirm = () => {
    if (!selectedEmployee) return
    const invoiceId = selectedInvoice ? Number(selectedInvoice) : undefined
    onConfirm({
      time,
      serviced_by: Number(selectedEmployee),
      ...(invoiceId ? { invoice_id: invoiceId } : {}),
      ...(!invoiceId && selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
    })
  }

  const chosenInvoice = invoices.find(i => String(i.id) === selectedInvoice)

  const getPrice = (t: SessionTime): number | null => {
    const plan = tariffPlans.find(
      p => p.device === instance.device && p.tariff === currentTariff && p.time === t
    )
    return plan?.price ?? null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="p-5">

          {/* Шапка */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Начать сеанс</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {instance.label || instance.device} · #{instance.id}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  currentTariff === 'MORNING'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                    : currentTariff === 'EVENING'
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                }`}>
                  {TARIFF_LABELS[currentTariff]}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
            >
              ✕
            </button>
          </div>

          {/* Сотрудник + Длительность в одну строку */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Сотрудник <span className="text-red-400">*</span>
              </p>
              {employeesLoading ? (
                <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ) : (
                <select
                  value={selectedEmployee}
                  onChange={e => setSelectedEmployee(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— выбрать —</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Длительность <span className="text-red-400">*</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {TIME_OPTIONS.map(opt => {
                  const price = getPrice(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTime(opt.value)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 ${
                        time === opt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {price !== null && (
                        <span className={`text-xs font-medium ${time === opt.value ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                          {price} AZN
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Счёт */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Счёт
              <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">(опционально)</span>
            </p>
            <select
              value={selectedInvoice}
              onChange={e => { setSelectedInvoice(e.target.value); clearCustomer() }}
              className={selectCls}
            >
              <option value="">— создать новый —</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  #{inv.id} · {inv.customer ?? 'Без имени'} · {inv.sessions.length} сеанс · {inv.total}AZN
                </option>
              ))}
            </select>
            {chosenInvoice && (
              <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                Сессия будет добавлена к счёту #{chosenInvoice.id}
              </p>
            )}
          </div>

          {/* Клиент — только если нет инвойса */}
          {!selectedInvoice && (
            <div className="mb-5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Клиент
                <span className="text-gray-400 dark:text-gray-600 font-normal ml-1">(опционально)</span>
              </p>
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null) }}
                    onFocus={() => customerResults.length > 0 && setShowDropdown(true)}
                    placeholder="Поиск по имени..."
                    className={selectCls + ' pr-8'}
                  />
                  {customerLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
                  )}
                  {selectedCustomer && (
                    <button
                      onClick={clearCustomer}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {showDropdown && customerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 text-gray-800 dark:text-gray-200"
                      >
                        {c.full_name}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && customerResults.length === 0 && !customerLoading && customerSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2.5 text-sm text-gray-400 dark:text-gray-500">
                    Не найдено
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedEmployee}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Запустить
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
