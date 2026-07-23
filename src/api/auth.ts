import client from './client'

export interface AuthResponse {
  token: string
}

export interface Me {
  id: number
  username: string
  first_name: string
  last_name: string
  email: string
  permissions: string[]
}

export const authenticate = (email: string, password: string) =>
  client.post<AuthResponse>('/auth/authenticate', { email, password })

export const getMe = () =>
  client.get<{ user: Me }>('/auth/valid').then(res => ({ ...res, data: res.data.user }))
