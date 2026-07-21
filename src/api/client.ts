import axios, { AxiosError } from 'axios'
import { API_BASE_URL } from '../config'
import { emitToast } from '../contexts/ToastContext'

const client = axios.create({ baseURL: API_BASE_URL })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function extractErrorMessage(error: AxiosError<any>): string {
  if (!error.response) {
    return 'Нет соединения с сервером. Проверьте интернет-соединение.'
  }

  const data = error.response.data
  if (data && typeof data === 'object') {
    const errors = (data as { errors?: Record<string, string[]> }).errors
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors).flat()[0]
      if (typeof first === 'string') return first
    }
    const message = (data as { message?: string }).message
    if (typeof message === 'string' && message) return message
  }

  switch (error.response.status) {
    case 401: return 'Сессия истекла, войдите снова.'
    case 403: return 'Недостаточно прав для этого действия.'
    case 404: return 'Запрашиваемые данные не найдены.'
    case 503: return 'Сервис временно недоступен, попробуйте позже.'
    default:  return `Ошибка запроса (${error.response.status})`
  }
}

client.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    emitToast(extractErrorMessage(error), 'error')
    return Promise.reject(error)
  },
)

export default client
