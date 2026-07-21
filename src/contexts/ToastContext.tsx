import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'

export type ToastType = 'error' | 'success' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION_MS = 5000

const TYPE_STYLES: Record<ToastType, string> = {
  error:   'border-red-200 dark:border-red-800 bg-white dark:bg-gray-900',
  success: 'border-green-200 dark:border-green-800 bg-white dark:bg-gray-900',
  info:    'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900',
}

const TYPE_ICON: Record<ToastType, string> = {
  error:   '⚠',
  success: '✓',
  info:    'ℹ',
}

const TYPE_ICON_CLS: Record<ToastType, string> = {
  error:   'text-red-500 dark:text-red-400',
  success: 'text-green-500 dark:text-green-400',
  info:    'text-blue-500 dark:text-blue-400',
}

let emit: ((message: string, type?: ToastType) => void) | null = null

/** Fires a toast from outside the React tree (e.g. the axios interceptor). No-op before ToastProvider mounts. */
export function emitToast(message: string, type: ToastType = 'error') {
  emit?.(message, type)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => dismiss(id), DURATION_MS)
  }, [dismiss])

  useEffect(() => {
    emit = showToast
    return () => { emit = null }
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm ${TYPE_STYLES[t.type]}`}
          >
            <span className={`text-base leading-none mt-0.5 ${TYPE_ICON_CLS[t.type]}`}>{TYPE_ICON[t.type]}</span>
            <p className="flex-1 text-gray-700 dark:text-gray-200">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors leading-none"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
