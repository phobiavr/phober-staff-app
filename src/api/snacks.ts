import client from './client'

export interface Snack {
  id: number
  name: string
  stock: number
  price: number
}

export interface SnackSaleParams {
  snack_id: number
  quantity: number
  invoice_id?: number
  customer_id?: number
  customer?: string
}

export const getSnacks = () =>
  client.get<Snack[]>('/staff/snacks').then(res => res.data)

export const createSnackSale = (params: SnackSaleParams) =>
  client.post<{ invoice_id: number }>('/staff/snacks', params).then(res => res.data)
