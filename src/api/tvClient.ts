import client from './client'

const TV_PARAMS_KEY = 'tv_signed_params'

export const storeTvParams = (params: string) =>
  sessionStorage.setItem(TV_PARAMS_KEY, params)

export const getTvParams = (): string | null =>
  sessionStorage.getItem(TV_PARAMS_KEY)

export const clearTvParams = () =>
  sessionStorage.removeItem(TV_PARAMS_KEY)

export const fetchTvSessions = <T>(): Promise<T> => {
  const params = getTvParams()
  if (!params) return Promise.reject(new Error('no tv params'))
  return client.get<T>(`/staff/tv/sessions${params}`).then(r => r.data)
}

// Called from Layout — requires staff JWT, returns 4-digit PIN
export const generateTvToken = () =>
  client.post<{ pin: string; expires_at: string }>('/staff/tv/token', {})
    .then(r => r.data)

// Called from TV page — no auth required, resolves PIN → stores signed params
export const resolveTvPin = async (pin: string): Promise<void> => {
  const res = await client.get<{ url: string }>(`/staff/tv/pin/${pin}`)
  const signedParams = new URL(res.data.url).search
  storeTvParams(signedParams)
}
