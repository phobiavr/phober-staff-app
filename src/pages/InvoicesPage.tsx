import { useCallback, useEffect, useRef, useState } from 'react'
import { Invoice, getInvoices, payInvoice, cancelInvoice } from '../api/invoices'
import { setSessionDiscount } from '../api/sessions'
import { printInvoice } from '../utils/printInvoice'
import { searchCustomers, Customer, LOYALTY_DISCOUNT, LOYALTY_LABEL, LOYALTY_COLOR } from '../api/crm'

type StatusFilter = 'ALL' | 'QUEUE' | 'PAYED' | 'CANCELED'
type PeriodFilter = 'TODAY' | 'WEEK' | 'MONTH'

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  TODAY: 'Сегодня', WEEK: 'Неделя', MONTH: 'Месяц',
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
}

function invoiceDate(inv: Invoice): Date | null {
  const iso = inv.created_at ?? inv.sessions[0]?.created_at ?? null
  return iso ? new Date(iso) : null
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  QUEUE:    { label: 'Ожидает', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  PAYED:    { label: 'Оплачен', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'    },
  CANCELED: { label: 'Отменён', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'           },
}

const FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: 'Все', QUEUE: 'Ожидают', PAYED: 'Оплачены', CANCELED: 'Отменённые',
}

const METHODS: { key: string; label: string }[] = [
  { key: 'CARD',  label: 'Карта'    },
  { key: 'CASH',  label: 'Наличные' },
  { key: 'BONUS', label: 'Бонус'    },
]

// ---------- LoyaltySection ----------
interface LoyaltySectionProps {
  sessions: Invoice['sessions']
  onApply: (sessionId: number, discount: number) => Promise<void>
}

function LoyaltySection({ sessions, onApply }: LoyaltySectionProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = (val: string) => {
    setQuery(val)
    setSelected(null)
    setDone(false)
    if (debounce.current) clearTimeout(debounce.current)
    if (!val.trim()) { setResults([]); return }
    debounce.current = setTimeout(() => {
      searchCustomers(val).then(setResults).catch(() => {})
    }, 300)
  }

  const handleSelect = (c: Customer) => {
    setSelected(c)
    setResults([])
    setQuery(c.full_name)
    setDone(false)
  }

  const handleApply = async () => {
    if (!selected?.loyalty_card) return
    const discount = LOYALTY_DISCOUNT[selected.loyalty_card.status]
    const eligible = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'FINISHED')
    setApplying(true)
    try {
      await Promise.all(eligible.map(s => onApply(s.id, discount)))
      setDone(true)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-2">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
        💳 Карта лояльности
      </p>

      {/* Поиск клиента */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Имя, телефон или код карты..."
          className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-all"
        />
        {results.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
            {results.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm text-gray-900 dark:text-gray-100">{c.full_name}</span>
                {c.loyalty_card ? (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LOYALTY_COLOR[c.loyalty_card.status]}`}>
                    {LOYALTY_LABEL[c.loyalty_card.status]}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">нет карты</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Выбранный клиент */}
      {selected && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{selected.full_name}</span>
            {selected.loyalty_card ? (
              <>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${LOYALTY_COLOR[selected.loyalty_card.status]}`}>
                  {LOYALTY_LABEL[selected.loyalty_card.status]}
                </span>
                <span className="text-xs text-gray-400 font-mono">{selected.loyalty_card.code}</span>
                <span className="text-xs text-orange-500 font-semibold">
                  −{LOYALTY_DISCOUNT[selected.loyalty_card.status] * 10}%
                </span>
              </>
            ) : (
              <span className="text-xs text-gray-400">карты нет</span>
            )}
          </div>
          {selected.loyalty_card && !done && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              {applying ? '...' : 'Применить ко всем сеансам'}
            </button>
          )}
          {done && (
            <span className="text-xs font-semibold text-green-500">✓ Скидка применена</span>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- PaymentForm ----------
interface PaymentFormProps {
  total: number
  onConfirm: (method: Record<string, number>) => Promise<void>
  onCancel: () => void
}

function PaymentForm({ total, onConfirm, onCancel }: PaymentFormProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>({ CARD: String(total) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selected = Object.keys(amounts)
  const entered  = Object.values(amounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const remaining = total - entered
  const isValid   = Math.abs(remaining) < 0.01 && selected.length > 0

  const toggleMethod = (key: string) => {
    setAmounts(prev => {
      const next = { ...prev }
      if (key in next) {
        delete next[key]
        // если осталась одна — выровнять до total
        const keys = Object.keys(next)
        if (keys.length === 1) next[keys[0]] = String(total)
      } else {
        // новый метод получает остаток
        const cur = Object.values(next).reduce((s, v) => s + (parseFloat(v) || 0), 0)
        next[key] = String(Math.max(0, total - cur))
      }
      return next
    })
    setError('')
  }

  const setAmount = (key: string, val: string) => {
    setAmounts(prev => ({ ...prev, [key]: val }))
    setError('')
  }

  const handleConfirm = async () => {
    if (!isValid) { setError(`Не хватает ${remaining.toFixed(0)} AZN`); return }
    setSaving(true)
    try {
      const method: Record<string, number> = {}
      for (const [k, v] of Object.entries(amounts)) method[k] = parseFloat(v)
      await onConfirm(method)
    } catch {
      setError('Ошибка при оплате')
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
      {/* Переключатели методов */}
      <div className="flex gap-2">
        {METHODS.map(m => (
          <button
            key={m.key}
            onClick={() => toggleMethod(m.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              m.key in amounts
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-blue-400'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Поля сумм */}
      <div className="space-y-2">
        {METHODS.filter(m => m.key in amounts).map(m => (
          <div key={m.key} className="flex items-center gap-2">
            <span className="w-20 text-xs text-gray-500 dark:text-gray-400 shrink-0">{m.label}</span>
            <input
              type="number"
              min={0}
              step={1}
              value={amounts[m.key]}
              onChange={e => setAmount(m.key, e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-all"
            />
            <span className="text-xs text-gray-400 shrink-0">AZN</span>
          </div>
        ))}
      </div>

      {/* Остаток / итог */}
      <div className={`flex items-center justify-between text-xs font-semibold ${
        isValid ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'
      }`}>
        <span>Итого: {total} AZN</span>
        <span>{isValid ? '✓ Сумма совпадает' : `Остаток: ${remaining.toFixed(0)} AZN`}</span>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={handleConfirm}
          disabled={!isValid || saving}
          className="flex-1 py-2 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Сохранение...' : 'Подтвердить оплату'}
        </button>
      </div>
    </div>
  )
}

// ---------- InvoicesPage ----------
export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('QUEUE')
  const [period, setPeriod] = useState<PeriodFilter>('TODAY')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [paying, setPaying] = useState<number | null>(null)
  const [applyingDiscount, setApplyingDiscount] = useState<number | null>(null)
  const isFirstLoad = useRef(true)

  const load = useCallback(() => {
    if (isFirstLoad.current) {
      setLoading(true)
    } else {
      setFetching(true)
      setExpanded(null)
    }
    getInvoices({
      status: filter === 'ALL' ? undefined : filter,
      period,
    })
      .then(data => {
        setInvoices(data.reverse())
        if (isFirstLoad.current) {
          isFirstLoad.current = false
          setLoading(false)
        } else {
          setFetching(false)
        }
      })
      .catch(() => {
        setLoading(false)
        setFetching(false)
      })
  }, [filter, period])

  useEffect(() => { load() }, [load])

  const handlePay = async (id: number, method: Record<string, number>) => {
    await payInvoice(id, method)
    setPaying(null)
    load()
  }

  const handleDiscount = async (sessionId: number, discount: number) => {
    setApplyingDiscount(sessionId)
    try {
      await setSessionDiscount(sessionId, discount)
      setInvoices(prev => prev.map(inv => {
        const hasSession = inv.sessions.some(s => s.id === sessionId)
        if (!hasSession) return inv
        const sessions = inv.sessions.map(s => {
          if (s.id !== sessionId) return s
          const end_price = parseFloat((s.price * (1 - discount * 0.1)).toFixed(2))
          return { ...s, discount, end_price }
        })
        const total = parseFloat(
          (sessions.reduce((sum, s) => sum + s.end_price, 0)
            + inv.snack_sales.reduce((sum, s) => sum + s.total, 0)).toFixed(2)
        )
        return { ...inv, sessions, total }
      }))
    } finally {
      setApplyingDiscount(null)
    }
  }

  const handleCancel = async (id: number) => {
    if (!confirm('Отменить счёт?')) return
    await cancelInvoice(id)
    load()
  }

  return (
    <div className="px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Счета</h1>
          {!loading && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{invoices.length} счетов</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
            {/* Период */}
            <div className="flex gap-1">
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {/* Статус */}
            <div className="flex gap-1.5 flex-wrap justify-end">
              {(Object.keys(FILTER_LABELS) as StatusFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : invoices.length === 0 && !fetching ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <div className="text-4xl mb-3">🧾</div>
          <p className="font-medium">Счетов нет</p>
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity duration-150 ${fetching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          {invoices.map(inv => {
            const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE['CANCELED']
            const isExpanded = expanded === inv.id
            const isPaying   = paying === inv.id

            const invDate = invoiceDate(inv)

            return (
              <div key={inv.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">

                {/* Строка счёта */}
                <button
                  onClick={() => { setExpanded(isExpanded ? null : inv.id); setPaying(null) }}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="shrink-0 w-12 text-center">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">#{inv.id}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{inv.sessions.length} сеанс</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {inv.customer ?? 'Без имени'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {invDate ? `${fmtDate(invDate.toISOString())} · ${fmtTime(invDate.toISOString())}` : '—'}
                      {inv.snack_sales.length > 0 && ` · +${inv.snack_sales.length} снек`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{inv.total} AZN</p>
                    {inv.payment_method && Object.keys(inv.payment_method).length > 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {Object.keys(inv.payment_method).map(k => METHODS.find(m => m.key === k)?.label ?? k).join(' + ')}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${st.cls}`}>
                    {st.label}
                  </span>
                  <span className="text-gray-400 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                </button>

                {/* Детали */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800">

                    {inv.sessions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Сеансы</p>
                        <div className="space-y-1.5">
                          {inv.sessions.map(s => {
                            const canDiscount = inv.status === 'QUEUE' && (s.status === 'ACTIVE' || s.status === 'FINISHED')
                            const busy = applyingDiscount === s.id
                            return (
                              <div key={s.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      Устройство #{s.instance_id}
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                                      {s.time} мин · {s.serviced_by_name ?? '—'}
                                    </span>
                                  </div>
                                  <div className="text-right ml-4 shrink-0">
                                    {s.discount > 0 && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 line-through mr-1">{s.price} AZN</span>
                                    )}
                                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.end_price} AZN</span>
                                    {s.discount > 0 && (
                                      <span className="ml-1.5 text-xs font-semibold text-orange-500 dark:text-orange-400">−{s.discount * 10}%</span>
                                    )}
                                  </div>
                                </div>
                                {canDiscount && (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Скидка:</span>
                                    {[10, 20, 30, 50, 100].map(pct => {
                                      const val = pct / 10
                                      const active = s.discount === val
                                      return (
                                        <button
                                          key={pct}
                                          disabled={busy}
                                          onClick={() => handleDiscount(s.id, active ? 0 : val)}
                                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                                            active
                                              ? 'bg-orange-500 text-white'
                                              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-orange-400 hover:text-orange-500'
                                          }`}
                                        >
                                          {busy && active ? '...' : `${pct}%`}
                                        </button>
                                      )
                                    })}
                                    {s.discount > 0 && (
                                      <button
                                        disabled={busy}
                                        onClick={() => handleDiscount(s.id, 0)}
                                        className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-white dark:bg-gray-700 text-red-400 border border-gray-200 dark:border-gray-600 hover:border-red-400 disabled:opacity-40 transition-colors"
                                      >
                                        {busy ? '...' : '× убрать'}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {inv.snack_sales.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Снеки</p>
                        <div className="space-y-1.5">
                          {inv.snack_sales.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                              <span className="text-sm text-gray-800 dark:text-gray-200">{s.snack} × {s.quantity}</span>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.total} AZN</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Карта лояльности */}
                    {inv.status === 'QUEUE' && (
                      <LoyaltySection
                        sessions={inv.sessions}
                        onApply={handleDiscount}
                      />
                    )}

                    {/* Итого + действия */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                          Итого: {inv.total} AZN
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => printInvoice(inv)}
                            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            🖨 Печать
                          </button>
                          {inv.status === 'QUEUE' && !isPaying && (
                            <>
                              <button
                                onClick={() => setPaying(inv.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                              >
                                Оплатить
                              </button>
                              <button
                                onClick={() => handleCancel(inv.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                              >
                                Отменить
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Форма оплаты */}
                      {inv.status === 'QUEUE' && isPaying && (
                        <PaymentForm
                          total={inv.total}
                          onConfirm={method => handlePay(inv.id, method)}
                          onCancel={() => setPaying(null)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
