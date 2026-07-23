import client from './client'

export type SessionTime = 'MIN_15' | 'MIN_30' | 'MIN_60'

export interface Session {
  id: number
  instance_id: number
  time: number       // minutes: 15, 30, 60
  status: string
  created_at: string
  started_at: string | null
  serviced_by_name: string | null
  customer: string | null
}

export interface CreateSessionParams {
  instance_id: number
  time: SessionTime
  serviced_by: number
  invoice_id?: number
  customer_id?: number
  customer?: string
}

export const getSessions = () =>
  client.get<Session[]>('/staff/sessions')

export const getTodaySessions = () =>
  client.get<Session[]>('/staff/sessions/today')

export const createSession = (params: CreateSessionParams) =>
  client.post<Session>('/staff/sessions', params)

export const startSession = (id: number) =>
  client.put<Session>(`/staff/sessions/${id}/start`, {})

export const cancelSession = (id: number) =>
  client.delete<void>(`/staff/sessions/${id}`)

export const finishSession = (id: number) =>
  client.put<void>(`/staff/sessions/${id}/finish`, {})

export const setSessionDiscount = (id: number, discount: number) =>
  client.put<void>(`/staff/sessions/${id}/discount`, { discount })
