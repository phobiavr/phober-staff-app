import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { API_BASE_URL } from '../config'

;(window as any).Pusher = Pusher

const apiUrl = new URL(API_BASE_URL)
const port = Number(apiUrl.port) || (apiUrl.protocol === 'https:' ? 443 : 80)
const forceTLS = apiUrl.protocol === 'https:'

type ChannelOptions = { headers?: Record<string, string> }
type AuthCallback = (
  error: Error | null,
  data: { auth: string; channel_data?: string } | null,
) => void

function authorizer(channel: { name: string }, _opts: ChannelOptions) {
  return {
    authorize: (socketId: string, callback: AuthCallback) => {
      const token = localStorage.getItem('token') ?? ''
      fetch(`${API_BASE_URL}/auth/broadcasting/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
          return res.json()
        })
        .then((data) => callback(null, data))
        .catch((err) => callback(err, null))
    },
  }
}

// @ts-ignore
const KEY: string = import.meta.env.VITE_REVERB_KEY ?? 'phober-key'

export const echo = new Echo({
  broadcaster: 'reverb',
  key: KEY,
  wsHost: apiUrl.hostname,
  wsPort: port,
  wssPort: port,
  forceTLS,
  enabledTransports: ['ws', 'wss'],
  wsPath: '/ws',
  authorizer,
})

;(window as any).echo = echo
