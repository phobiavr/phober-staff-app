import { useEffect, useRef, useState } from 'react'
import { Snack, getSnacks, createSnackSale } from '../api/snacks'
import { Invoice, getOpenInvoices } from '../api/invoices'
import { Customer, searchCustomers } from '../api/crm'

type CartItem = { snack: Snack; qty: number }

const selectCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all'

export default function BarPage() {
  const [snacks, setSnacks]     = useState<Snack[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)

  const [cart, setCart] = useState<Record<number, number>>({}) // snack_id → qty

  const [selectedInvoice, setSelectedInvoice] = useState<string>('')

  const [customerSearch, setCustomerSearch]   = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown]       = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState<number | null>(null) // invoice_id after success
  const [error, setError]           = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getSnacks(), getOpenInvoices()])
      .then(([s, inv]) => { setSnacks(s); setInvoices(inv) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (customerSearch.trim().length < 2) {
      setCustomerResults([]); setShowDropdown(false); return
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

  const setQty = (id: number, delta: number) => {
    setCart(prev => {
      const next = { ...prev }
      const cur  = (next[id] ?? 0) + delta
      if (cur <= 0) delete next[id]
      else          next[id] = cur
      return next
    })
  }

  const cartItems: CartItem[] = snacks
    .filter(s => cart[s.id])
    .map(s => ({ snack: s, qty: cart[s.id] }))

  const cartTotal = cartItems.reduce((s, i) => s + i.snack.price * i.qty, 0)

  const handleSubmit = async () => {
    if (cartItems.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      let invoiceId = selectedInvoice ? Number(selectedInvoice) : undefined
      for (const item of cartItems) {
        const res = await createSnackSale({
          snack_id:    item.snack.id,
          quantity:    item.qty,
          invoice_id:  invoiceId,
          customer_id: !invoiceId && selectedCustomer ? selectedCustomer.id : undefined,
        })
        if (!invoiceId) invoiceId = res.invoice_id
      }
      setDone(invoiceId!)
      setCart({})
      setSelectedInvoice('')
      setSelectedCustomer(null)
      setCustomerSearch('')
    } catch {
      setError('Ошибка при оформлении')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNew = () => { setDone(null); getSnacks().then(setSnacks).catch(() => {}) }

  if (loading) {
    return (
      <div className="px-4 py-5 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-white dark:bg-gray-900 rounded-xl animate-pulse border border-gray-100 dark:border-gray-800" />
        ))}
      </div>
    )
  }

  if (done !== null) {
    return (
      <div className="px-4 py-5 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Заказ оформлен!</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Счёт #{done}</p>
        <button
          onClick={handleNew}
          className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Новый заказ
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 flex flex-col lg:flex-row gap-5 items-start">
      {/* Корзина / оформление */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 sticky top-20">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Заказ</h2>

          {cartItems.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Добавьте снеки из меню</p>
          ) : (
            <div className="space-y-1.5 mb-4">
              {cartItems.map(({ snack, qty }) => (
                <div key={snack.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{snack.name} × {qty}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 shrink-0">{snack.price * qty} AZN</span>
                </div>
              ))}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100">
                <span>Итого</span>
                <span>{cartTotal} AZN</span>
              </div>
            </div>
          )}

          {/* Счёт */}
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Счёт</p>
            <select
              value={selectedInvoice}
              onChange={e => { setSelectedInvoice(e.target.value); setSelectedCustomer(null); setCustomerSearch('') }}
              className={selectCls}
            >
              <option value="">— создать новый —</option>
              {invoices.map(inv => (
                <option key={inv.id} value={inv.id}>
                  #{inv.id} · {inv.customer ?? 'Без имени'} · {inv.total} AZN
                </option>
              ))}
            </select>
          </div>

          {/* Клиент — только если новый счёт */}
          {!selectedInvoice && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                Клиент <span className="text-gray-400 font-normal">(опционально)</span>
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
                      onClick={() => { setSelectedCustomer(null); setCustomerSearch('') }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >✕</button>
                  )}
                </div>
                {showDropdown && customerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    {customerResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.full_name); setShowDropdown(false) }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0 text-gray-800 dark:text-gray-200"
                      >
                        {c.full_name}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && customerResults.length === 0 && !customerLoading && customerSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2.5 text-sm text-gray-400">
                    Не найдено
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={cartItems.length === 0 || submitting}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Оформление...' : `Оформить · ${cartTotal} AZN`}
          </button>
        </div>
      </div>

      {/* Снеки */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Бар</h1>
        {snacks.length === 0 ? (
          <div className="text-center py-20 text-gray-400 dark:text-gray-600">
            <div className="text-4xl mb-3">🍿</div>
            <p className="font-medium">Снеки не найдены</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {snacks.map(snack => {
              const qty = cart[snack.id] ?? 0
              const outOfStock = snack.stock <= 0
              return (
                <div
                  key={snack.id}
                  className={`bg-white dark:bg-gray-900 border rounded-xl p-3 flex flex-col gap-2 transition-all ${
                    qty > 0
                      ? 'border-blue-400 dark:border-blue-500 shadow-sm'
                      : 'border-gray-100 dark:border-gray-800'
                  } ${outOfStock ? 'opacity-50' : ''}`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{snack.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {snack.price} AZN · остаток: {snack.stock}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    {qty > 0 ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(snack.id, -1)}
                          className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-base hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                        >−</button>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 w-4 text-center">{qty}</span>
                        <button
                          onClick={() => setQty(snack.id, +1)}
                          disabled={qty >= snack.stock}
                          className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-base hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center"
                        >+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => !outOfStock && setQty(snack.id, 1)}
                        disabled={outOfStock}
                        className="w-full py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed transition-colors"
                      >
                        Добавить
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
