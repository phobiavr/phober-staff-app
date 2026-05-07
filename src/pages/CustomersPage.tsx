import { useEffect, useRef, useState } from 'react'
import { Customer, CustomerPayload, LoyaltyStatus, getCustomers, createCustomer, updateCustomer, setLoyaltyCard, LOYALTY_LABEL, LOYALTY_COLOR } from '../api/crm'
import CustomerModal from '../components/CustomerModal'

const CONTACT_ICONS: Record<string, string> = {
  phone: '📞', email: '✉️', telegram: '✈️', instagram: '📸', whatsapp: '💬', other: '🔗',
}

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [modalCustomer, setModalCustomer] = useState<Customer | null | 'new'>('new' as never)
  const [modalOpen, setModalOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef   = useRef(search)
  searchRef.current = search

  const load = (p: number, q: string) => {
    setLoading(true)
    getCustomers(p, 15, q || undefined)
      .then(res => {
        setCustomers(res.data)
        setTotalPages(res.total_pages)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1, '') }, [])

  const handleSearch = (val: string) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(1, val)
    }, 350)
  }

  const handlePage = (p: number) => {
    setPage(p)
    load(p, search)
  }

  const openCreate = () => {
    setModalCustomer(null)
    setModalOpen(true)
  }

  const openEdit = (c: Customer) => {
    setModalCustomer(c)
    setModalOpen(true)
  }

  const handleSave = async (
    data: CustomerPayload,
    loyaltyCard?: { code: string; status: LoyaltyStatus } | null,
  ) => {
    let saved: Customer
    if (modalCustomer && modalCustomer !== 'new' && (modalCustomer as Customer).id) {
      saved = await updateCustomer((modalCustomer as Customer).id, data)
    } else {
      saved = await createCustomer(data)
    }

    if (loyaltyCard) {
      saved = await setLoyaltyCard(saved.id, loyaltyCard)
    }

    setCustomers(prev => {
      const exists = prev.some(c => c.id === saved.id)
      return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev]
    })
    setTotal(prev => modalCustomer ? prev : prev + 1)
  }

  return (
    <div className="px-4 py-5">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Клиенты</h1>
          {!loading && <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{total} клиентов</p>}
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          + Новый клиент
        </button>
      </div>

      {/* Поиск */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Поиск по имени, контакту, заметке..."
          className="w-full max-w-md px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
        />
      </div>

      {/* Список */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-white dark:bg-gray-900 rounded-xl animate-pulse border border-gray-100 dark:border-gray-800" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-600">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-medium">{search ? 'Ничего не найдено' : 'Клиентов пока нет'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customers.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4"
            >
              {/* Аватар */}
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-sm font-bold text-gray-500 dark:text-gray-400">
                {c.first_name[0]}{c.last_name[0]}
              </div>

              {/* Имя + карта + день рождения */}
              <div className="w-48 shrink-0 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{c.full_name}</p>
                  {c.loyalty_card && (
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LOYALTY_COLOR[c.loyalty_card.status]}`}>
                      {LOYALTY_LABEL[c.loyalty_card.status]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {c.loyalty_card ? (
                    <span className="font-mono tracking-wide">{c.loyalty_card.code}</span>
                  ) : fmtDate(c.birthday)}
                  {c.days_until_birthday !== null && c.days_until_birthday <= 14 && (
                    <span className="ml-2 text-pink-500 font-medium">
                      🎂 через {c.days_until_birthday === 0 ? 'сегодня!' : `${c.days_until_birthday}д`}
                    </span>
                  )}
                </p>
              </div>

              {/* Контакты */}
              <div className="flex-1 min-w-0 flex flex-wrap gap-1.5">
                {c.contacts.length === 0 ? (
                  <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                ) : c.contacts.map((ct, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-lg"
                  >
                    <span>{CONTACT_ICONS[ct.type] ?? '🔗'}</span>
                    <span className="truncate max-w-[120px]">{ct.value}</span>
                  </span>
                ))}
              </div>

              {/* Заметка */}
              {c.note && (
                <p className="hidden lg:block text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">
                  {c.note}
                </p>
              )}

              {/* Кнопка редактирования */}
              <button
                onClick={() => openEdit(c)}
                className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Изменить
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-5">
          <button
            onClick={() => handlePage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | '...')[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
              acc.push(p)
              return acc
            }, [])
            .map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => handlePage(p as number)}
                  className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => handlePage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            →
          </button>
        </div>
      )}

      {modalOpen && (
        <CustomerModal
          customer={modalCustomer as Customer | null}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}
