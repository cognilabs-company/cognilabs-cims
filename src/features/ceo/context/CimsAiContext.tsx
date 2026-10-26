import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { aiService } from '../../../shared/api/services/ai.service'
import type { AiChatResponse } from '../../../shared/api/types'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { useToast } from '../../../shared/toast/useToast'
import {
  cimsAiLoadingStages,
  createCimsAiMessageId,
  extractCimsAiAnswer,
  getPresetCimsAiAnswer,
  type CimsAiLoadingStage,
  type CimsAiChatMessage,
} from '../lib/cimsAi'

type CimsAiContextValue = {
  draft: string
  history: CimsAiChatMessage[]
  isSubmitting: boolean
  loadingStage: CimsAiLoadingStage
  latestAssistantResponse?: AiChatResponse
  setDraft: (value: string) => void
  fillPrompt: (value: string) => void
  submitQuestion: (question?: string) => Promise<void>
  clearConversation: () => void
}

const CimsAiContext = createContext<CimsAiContextValue | null>(null)
const STORAGE_PREFIX = 'cims-ai-chat'

type StoredCimsAiState = {
  draft?: string
  history?: CimsAiChatMessage[]
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function loadStoredState(storageKey: string): StoredCimsAiState {
  if (!isBrowser()) {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(storageKey)

    if (!raw) {
      return {}
    }

    return JSON.parse(raw) as StoredCimsAiState
  } catch {
    return {}
  }
}

export function CimsAiProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${user?.id ?? 'anonymous'}`, [user?.id])

  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<CimsAiChatMessage[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingStage, setLoadingStage] = useState<CimsAiLoadingStage>('analyzing')

  useEffect(() => {
    const stored = loadStoredState(storageKey)
    setDraft(typeof stored.draft === 'string' ? stored.draft : '')
    setHistory(Array.isArray(stored.history) ? stored.history.slice(-40) : [])
  }, [storageKey])

  useEffect(() => {
    if (!isBrowser()) {
      return
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        draft,
        history: history.slice(-40),
      }),
    )
  }, [draft, history, storageKey])

  const latestAssistantResponse = useMemo(
    () => [...history].reverse().find((entry) => entry.role === 'assistant')?.response,
    [history],
  )

  const clearConversation = useCallback(() => {
    setHistory([])
    setDraft('')
  }, [])

  const fillPrompt = useCallback((value: string) => {
    setDraft(value)
  }, [])

  const submitQuestion = useCallback(async (question?: string) => {
    const normalizedQuestion = (question ?? draft).trim()

    if (!normalizedQuestion || isSubmitting) {
      return
    }

    const userMessage: CimsAiChatMessage = {
      id: createCimsAiMessageId(),
      role: 'user',
      content: normalizedQuestion,
      createdAt: Date.now(),
    }

    setHistory((current) => [...current, userMessage])
    setDraft('')
    setIsSubmitting(true)
    setLoadingStage('analyzing')
    const presetAnswer = getPresetCimsAiAnswer(normalizedQuestion)

    const stageTimeouts = [
      window.setTimeout(() => setLoadingStage(cimsAiLoadingStages[1].key), 1200),
      window.setTimeout(() => setLoadingStage(cimsAiLoadingStages[2].key), 2600),
    ]

    try {
      const response = await aiService.chat({ question: normalizedQuestion })
      const assistantMessage: CimsAiChatMessage = {
        id: createCimsAiMessageId(),
        role: 'assistant',
        content: presetAnswer ?? extractCimsAiAnswer(response),
        createdAt: Date.now(),
        response,
      }

      setHistory((current) => [...current, assistantMessage])
    } catch (error) {
      if (presetAnswer) {
        setHistory((current) => [
          ...current,
          {
            id: createCimsAiMessageId(),
            role: 'assistant',
            content: presetAnswer,
            createdAt: Date.now(),
          },
        ])
        return
      }

      showToast({
        title: 'AI request failed',
        description: getApiErrorMessage(error),
        tone: 'error',
      })
    } finally {
      stageTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
      setIsSubmitting(false)
    }
  }, [draft, isSubmitting, showToast])

  const value = useMemo<CimsAiContextValue>(() => ({
    draft,
    history,
    isSubmitting,
    loadingStage,
    latestAssistantResponse,
    setDraft,
    fillPrompt,
    submitQuestion,
    clearConversation,
  }), [clearConversation, draft, fillPrompt, history, isSubmitting, latestAssistantResponse, loadingStage, submitQuestion])

  return (
    <CimsAiContext.Provider value={value}>
      {children}
    </CimsAiContext.Provider>
  )
}

export function useCimsAi() {
  const context = useContext(CimsAiContext)

  if (!context) {
    throw new Error('useCimsAi must be used within CimsAiProvider')
  }

  return context
}
