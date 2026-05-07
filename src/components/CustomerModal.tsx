import { useEffect, useState } from 'react'
import { Customer, CustomerPayload, Contact, LoyaltyStatus, LOYALTY_LABEL, LOYALTY_COLOR } from '../api/crm'

const CONTACT_TYPES = ['phone', 'email', 'telegram', 'instagram', 'whatsapp', 'other']
const TIERS: LoyaltyStatus[] = ['BASIC', 'SILVER', 'GOLD', 'PLATINUM']

interface LoyaltyDraft {
  code: string
  status: LoyaltyStatus
}

interface Props {
  customer: Customer | null  // null = create
  onSave: (data: CustomerPayload, loyalty?: LoyaltyDraft | null) => Promise<void>
  onClose: () => void
}

const empty = (): CustomerPayload => ({
  first_name: '',
  last_name:  '',
  birthday:   '',
  gender:     null,
  note:       '',
  contacts:   [],
})

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const part = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `PH-${part(4)}-${part(4)}`
}

export default function CustomerModal({ customer, onSave, onClose }: Props) {
  const [form, setForm]             = useState<CustomerPayload>(empty)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Loyalty card state
  const [hasCard, setHasCard]       = useState(false)
  const [cardCode, setCardCode]     = useState('')
  const [cardStatus, setCardStatus] = useState<LoyaltyStatus>('BASIC')

  useEffect(() => {
    if (customer) {
      setForm({
        first_name: customer.first_name,
        last_name:  customer.last_name,
        birthday:   customer.birthday?.slice(0, 10) ?? '',
        gender:     customer.gender ?? null,
        note:       customer.note ?? '',
        contacts:   customer.contacts.map(c => ({ type: c.type, value: c.value })),
      })
      if (customer.loyalty_card) {
        setHasCard(true)
        setCardCode(customer.loyalty_card.code)
        setCardStatus(customer.loyalty_card.status)
      } else {
        setHasCard(false)
        setCardCode('')
        setCardStatus('BASIC')
      }
    } else {
      setForm(empty())
      setHasCard(false)
      setCardCode('')
      setCardStatus('BASIC')
    }
    setError('')
  }, [customer])

  const set = (key: keyof CustomerPayload, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const setContact = (i: number, field: keyof Contact, value: string) =>
    setForm(prev => {
      const contacts = [...(prev.contacts ?? [])]
      contacts[i] = { ...contacts[i], [field]: value }
      return { ...prev, contacts }
    })

  const addContact = () =>
    setForm(prev => ({ ...prev, contacts: [...(prev.contacts ?? []), { type: 'phone', value: '' }] }))

  const removeContact = (i: number) =>
    setForm(prev => ({ ...prev, contacts: (prev.contacts ?? []).filter((_, idx) => idx !== i) }))

  const toggleCard = (on: boolean) => {
    setHasCard(on)
    if (on && !cardCode) setCardCode(genCode())
  }

  const handleSubmit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.birthday) {
      setError('Заполните имя, фамилию и дату рождения')
      return
    }
    if (hasCard && !cardCode.trim()) {
      setError('Введите код карты')
      return
    }
    setSaving(true)
    setError('')
    try {
      const loyalty: LoyaltyDraft | null = hasCard ? { code: cardCode.trim(), status: cardStatus } : null
      await onSave(form, loyalty)
      onClose()
    } catch {
      setError('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all'
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">
            {customer ? 'Редактировать клиента' : 'Новый клиент'}
          </h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Имя + Фамилия */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className={labelCls}>Имя <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Иван"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Фамилия <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Иванов"
                className={inputCls}
              />
            </div>
          </div>

          {/* Дата рождения + Пол */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className={labelCls}>Дата рождения <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={form.birthday}
                onChange={e => set('birthday', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Пол</label>
              <div className="flex gap-2 h-[42px]">
                {[{ v: 'M', l: '♂ Муж' }, { v: 'F', l: '♀ Жен' }].map(({ v, l }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('gender', form.gender === v ? null : v)}
                    className={`flex-1 rounded-xl text-sm font-medium border transition-colors ${
                      form.gender === v
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Заметка */}
          <div className="mb-4">
            <label className={labelCls}>Заметка</label>
            <textarea
              value={form.note ?? ''}
              onChange={e => set('note', e.target.value)}
              placeholder="Любая информация о клиенте..."
              rows={2}
              className={inputCls + ' resize-none'}
            />
          </div>

          {/* Контакты */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls + ' mb-0'}>Контакты</label>
              <button
                type="button"
                onClick={addContact}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                + добавить
              </button>
            </div>
            <div className="space-y-2">
              {(form.contacts ?? []).map((c, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={c.type}
                    onChange={e => setContact(i, 'type', e.target.value)}
                    className="w-32 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-all"
                  >
                    {CONTACT_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={c.value}
                    onChange={e => setContact(i, 'value', e.target.value)}
                    placeholder="Значение"
                    className={inputCls + ' flex-1'}
                  />
                  <button
                    type="button"
                    onClick={() => removeContact(i)}
                    className="px-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Карта лояльности */}
          <div className="mb-6 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleCard(!hasCard)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">💳</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Карта лояльности</span>
                {customer?.loyalty_card && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${LOYALTY_COLOR[customer.loyalty_card.status]}`}>
                    {LOYALTY_LABEL[customer.loyalty_card.status]}
                  </span>
                )}
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors relative ${hasCard ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${hasCard ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>

            {hasCard && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                {/* Тир */}
                <div>
                  <label className={labelCls}>Тир</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TIERS.map(tier => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setCardStatus(tier)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                          cardStatus === tier
                            ? LOYALTY_COLOR[tier] + ' border-current'
                            : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        {LOYALTY_LABEL[tier]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Код */}
                <div>
                  <label className={labelCls}>Код карты</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cardCode}
                      onChange={e => setCardCode(e.target.value.toUpperCase())}
                      placeholder="PH-XXXX-XXXX"
                      className={inputCls + ' font-mono tracking-wide flex-1'}
                    />
                    <button
                      type="button"
                      onClick={() => setCardCode(genCode())}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shrink-0"
                      title="Сгенерировать код"
                    >
                      ↻
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Кнопки */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
