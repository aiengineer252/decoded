import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReadingLevel } from '../types'

const STORAGE_KEY = 'decoded:reading-level'

interface Ctx {
  level: ReadingLevel
  setLevel: (l: ReadingLevel) => void
}

const ReadingLevelContext = createContext<Ctx>({ level: 'practitioner', setLevel: () => {} })

function readStored(): ReadingLevel {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'beginner' || v === 'practitioner' || v === 'expert') return v
  } catch {
    /* private mode, blocked storage — the default is fine */
  }
  return 'practitioner'
}

export function ReadingLevelProvider({ children }: { children: React.ReactNode }) {
  // Default to practitioner rather than beginner: someone who lands here from a
  // technical link is more often mid-level than new, and a reader who is over-
  // explained to bounces faster than one who reaches for the simpler tab.
  const [level, setLevelState] = useState<ReadingLevel>('practitioner')

  useEffect(() => {
    setLevelState(readStored())
  }, [])

  const setLevel = useCallback((l: ReadingLevel) => {
    setLevelState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* not worth failing the interaction over */
    }
  }, [])

  return (
    <ReadingLevelContext.Provider value={{ level, setLevel }}>
      {children}
    </ReadingLevelContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useReadingLevel() {
  return useContext(ReadingLevelContext)
}

export const LEVEL_META: Record<
  ReadingLevel,
  { label: string; blurb: string; assumes: string }
> = {
  beginner: {
    label: 'New to this',
    blurb: 'Explains the jargon',
    assumes: 'You can code. You have not shipped an AI system.',
  },
  practitioner: {
    label: 'I ship this',
    blurb: 'Straight to the mechanism',
    assumes: 'You build with this stuff and want the how, fast.',
  },
  expert: {
    label: 'Deep',
    blurb: 'Only what is non-obvious',
    assumes: 'You know the field. Skip the setup.',
  },
}
