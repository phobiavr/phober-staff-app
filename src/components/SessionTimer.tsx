import { useEffect, useState } from 'react'

interface Props {
  endsAt: number  // Unix timestamp ms
  onExpire: () => void
}

export default function SessionTimer({ endsAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
  )

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((endsAt - Date.now()) / 1000))

    const interval = setInterval(() => {
      const secs = calc()
      setRemaining(secs)
      if (secs === 0) {
        clearInterval(interval)
        onExpire()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endsAt, onExpire])

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  const isLow = remaining > 0 && remaining <= 60

  return (
    <span className={`font-mono font-bold text-lg tabular-nums ${isLow ? 'text-red-500 animate-pulse' : 'text-green-600'}`}>
      {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(s)}
    </span>
  )
}
