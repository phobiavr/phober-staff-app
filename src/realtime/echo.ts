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

function makeAuthorizer(authEndpoint: string) {
  return (channel: { name: string }, _opts: ChannelOptions) => ({
    authorize: (socketId: string, callback: AuthCallback) => {
      const token = localStorage.getItem('token') ?? ''
      fetch(authEndpoint, {
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
  })
}

function makeEcho(opts: {
  key: string
  wsPath: string
  authEndpoint: string
}) {
  return new Echo({
    broadcaster: 'reverb',
    key: opts.key,
    wsHost: apiUrl.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    wsPath: opts.wsPath,
    authorizer: makeAuthorizer(opts.authEndpoint),
  })
}

// @ts-ignore
const SESSIONS_KEY = import.meta.env.VITE_REVERB_SESSIONS_KEY ?? 'sessions-key'
// @ts-ignore
const SCHEDULE_KEY = import.meta.env.VITE_REVERB_SCHEDULE_KEY ?? 'schedule-key'

export const echoSessions = makeEcho({
  key: SESSIONS_KEY,
  wsPath: '/ws/sessions',
  authEndpoint: `${API_BASE_URL}/staff/broadcasting/auth`,
})

export const echoSchedule = makeEcho({
  key: SCHEDULE_KEY,
  wsPath: '/ws/schedule',
  authEndpoint: `${API_BASE_URL}/hardware/broadcasting/auth`,
})

;(window as any).echoSessions = echoSessions
;(window as any).echoSchedule = echoSchedule
