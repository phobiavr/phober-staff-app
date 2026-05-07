import client from './client'

export interface AuthResponse {
  token: string
}

export const authenticate = (email: string, password: string) =>
  client.post<AuthResponse>('/auth/authenticate', { email, password })
