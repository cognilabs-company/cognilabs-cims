import { useContext } from 'react'
import { CimsAiContext } from '../context/CimsAiContext'

export function useCimsAi() {
  const context = useContext(CimsAiContext)

  if (!context) {
    throw new Error('useCimsAi must be used within CimsAiProvider')
  }

  return context
}
