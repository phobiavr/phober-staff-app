import client from './client'
import { API_BASE_URL } from '../config'

export interface Schedule {
  type: string      // IN_SESSION | MAINTENANCE | RESERVATION | INSPECTION | REPAIR | ON_EVENT | CANCELED | N/A
  countdown: number // seconds remaining, -1 = no end date, 0 = no schedule
  start: string | null
  end: string | null
}

export interface UpcomingSchedule {
  type: string
  starts_in: number // seconds until start
}

export interface Instance {
  id: number
  label: string
  device: string
  mac_address: string | null
  active: boolean
  created_at: string
  schedule: Schedule | null
  upcoming_schedule: UpcomingSchedule | null
}

export interface Device {
  id: number
  name: string
  type: string
  slug: string
  logo: string
}

const DEFAULT_SCHEDULE: Schedule = { type: 'N/A', countdown: 0, start: null, end: null }

export const normalizeInstance = (i: Instance): Instance => ({
  ...i,
  schedule: i.schedule ?? DEFAULT_SCHEDULE,
})

export const getInstances = () =>
  client.get<Instance[]>('/hardware/instances').then(res => ({
    ...res,
    data: res.data.map(normalizeInstance),
  }))

export const getDevices = () =>
  client.get<Device[]>('/hardware/devices').then(res => res.data)

const resolveLogoUrl = (logo: string) =>
  logo && logo.startsWith('/') ? `${API_BASE_URL}${logo}` : logo

export const buildLogoMap = (devices: Device[]): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const d of devices) map[d.type] = resolveLogoUrl(d.logo)
  return map
}
