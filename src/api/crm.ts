import client from './client'

export interface Contact {
  type: string
  value: string
}

export type LoyaltyStatus = 'BASIC' | 'SILVER' | 'GOLD' | 'PLATINUM'

export interface LoyaltyCard {
  code: string
  status: LoyaltyStatus
}

export const LOYALTY_DISCOUNT: Record<LoyaltyStatus, number> = {
  BASIC:    1,
  SILVER:   2,
  GOLD:     3,
  PLATINUM: 5,
}

export const LOYALTY_LABEL: Record<LoyaltyStatus, string> = {
  BASIC:    'Basic',
  SILVER:   'Silver',
  GOLD:     'Gold',
  PLATINUM: 'Platinum',
}

export const LOYALTY_COLOR: Record<LoyaltyStatus, string> = {
  BASIC:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  SILVER:   'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  GOLD:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  PLATINUM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

export interface Customer {
  id: number
  full_name: string
  first_name: string
  last_name: string
  status: string
  birthday: string | null
  gender: string | null
  note: string | null
  contacts: Contact[]
  loyalty_card: LoyaltyCard | null
  days_until_birthday: number | null
}

export interface CustomerPayload {
  first_name: string
  last_name: string
  birthday: string
  gender?: string | null
  note?: string | null
  contacts?: Contact[]
}

interface PagedResponse<T> {
  data: T[]
  current_page: number
  size: number
  total: number
  total_pages: number
}

export const searchCustomers = (trim: string) =>
  client
    .get<PagedResponse<Customer>>('/crm/customers', { params: { trim, size: 7, page: 1 } })
    .then(res => res.data.data)

export const getCustomers = (page = 1, size = 15, trim?: string) =>
  client
    .get<PagedResponse<Customer>>('/crm/customers', { params: { page, size, ...(trim ? { trim } : {}) } })
    .then(res => res.data)

export const createCustomer = (data: CustomerPayload) =>
  client.post<Customer>('/crm/customers', data).then(res => res.data)

export const updateCustomer = (id: number, data: CustomerPayload) =>
  client.put<Customer>(`/crm/customers/${id}`, data).then(res => res.data)

export const setLoyaltyCard = (customerId: number, card: { code: string; status: LoyaltyStatus }) =>
  client.put<Customer>(`/crm/customers/${customerId}/loyalty-card`, card).then(res => res.data)
