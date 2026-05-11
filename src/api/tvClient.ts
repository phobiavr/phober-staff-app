import client from './client'

const TV_PARAMS_KEY = 'tv_signed_params'

// Stores only the query string portion: "?expires=...&signature=..."
export const storeTvParams = (params: string) =>
  sessionStorage.setItem(TV_PARAMS_KEY, params)

export const getTvParams = (): string | null =>
  sessionStorage.getItem(TV_PARAMS_KEY)

export const fetchTvSessions = <T>(): Promise<T> => {
  const params = getTvParams()
  if (!params) return Promise.reject(new Error('no tv params'))
  return client.get<T>(`/staff/tv/sessions${params}`).then(r => r.data)
}

// Called from Layout — requires staff JWT, extracts signed params from the returned URL
export const generateTvToken = () =>
  client.post<{ url: string; expires_at: string }>('/staff/tv/token', {})
    .then(r => {
      const signedParams = new URL(r.data.url).search  // "?expires=...&signature=..."
      return { params: signedParams, expires_at: r.data.expires_at }
    })
