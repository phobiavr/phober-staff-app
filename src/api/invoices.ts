import client from './client'

export interface InvoiceSession {
  id: number
  instance_id: number
  time: number
  price: number
  discount: number
  end_price: number
  status: string
  created_at: string
  serviced_by_name: string | null
}

export interface InvoiceSnackSale {
  id: number
  snack: string
  quantity: number
  price: number
  total: number
}

export interface Invoice {
  id: number
  customer_id: number | null
  customer: string | null
  status: string
  sessions: InvoiceSession[]
  snack_sales: InvoiceSnackSale[]
  payment_method: Record<string, number> | null
  total: number
  created_at: string | null
}

export const getInvoices = (params?: { status?: string; period?: string }) =>
  client.get<Invoice[]>('/staff/invoices', { params }).then(res => res.data)

export const getOpenInvoices = () =>
  getInvoices({ status: 'QUEUE', period: 'TODAY' })

// method: { CARD: 500, CASH: 300 } — суммы должны равняться invoice.total
export const payInvoice = (id: number, method: Record<string, number>) =>
  client.put<void>(`/staff/invoices/${id}`, { method })

export const cancelInvoice = (id: number) =>
  client.delete<void>(`/staff/invoices/${id}`)
