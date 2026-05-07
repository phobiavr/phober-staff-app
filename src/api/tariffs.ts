import client from './client'

export type TariffType = 'MORNING' | 'EVENING' | 'EXTRA'
export type SessionTime = 'MIN_15' | 'MIN_30' | 'MIN_60'

export interface TariffPlan {
  id: number
  device: string
  tariff: TariffType
  time: SessionTime
  price: number
}

export const getTariffPlans = () =>
  client.get<TariffPlan[]>('/hardware/tariff-plans').then(res => res.data)

export const getCurrentTariff = (): TariffType => {
  const hour = new Date().getHours()
  return hour >= 12 ? 'EVENING' : 'MORNING'
}

export const TIME_MINS: Record<SessionTime, number> = {
  MIN_15: 15,
  MIN_30: 30,
  MIN_60: 60,
}
