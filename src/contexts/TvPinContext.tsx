import { createContext, useContext, useState } from 'react'

type TvPinContextType = {
  tvPin: string | null
  setTvPin: (pin: string | null) => void
}

const TvPinContext = createContext<TvPinContextType>({ tvPin: null, setTvPin: () => {} })

export function TvPinProvider({ children }: { children: React.ReactNode }) {
  const [tvPin, setTvPin] = useState<string | null>(null)
  return <TvPinContext.Provider value={{ tvPin, setTvPin }}>{children}</TvPinContext.Provider>
}

export const useTvPin = () => useContext(TvPinContext)
