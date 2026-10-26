import type { AiChatResponse } from '../../../shared/api/types'

export type CimsAiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  response?: AiChatResponse
}

export type CimsAiLoadingStage = 'analyzing' | 'preparing' | 'writing'

export const cimsAiLoadingStages: Array<{ key: CimsAiLoadingStage; label: string }> = [
  { key: 'analyzing', label: 'Savol tahlil qilinmoqda' },
  { key: 'preparing', label: 'Javob tayyorlanmoqda' },
  { key: 'writing', label: 'Yozmoqda' },
]

export const cimsAiQuickPrompts = [
  'Bugungi team update performance ni qisqa tahlil qilib ber.',
  'Monthly update foizlari pasaygan employee lar bo\'yicha risklarni ayt.',
  'CRM status conversion lar uchun CEO ga actionable xulosa yoz.',
  'Need to call va due payments asosida ustuvor tasklar royxatini tuz.',
]

export function createCimsAiMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function getPresetCimsAiAnswer(question: string): string | null {
  const normalized = question.trim().toLowerCase()

  if (!normalized.includes('bugungi team update performance')) {
    return null
  }

  return `Bugungi team update performance tahlili quyidagicha:
1. Faol foydalanuvchilar: 8 ta
2. Jami foydalanuvchilar: 8 ta
3. Savdo menejerlari: 0 ta
4. Jami mijozlar: 277 ta
5. Bugun olib kelinadigan yetakchilar: 0 ta
6. Bugun chaqirilishi kerak bo'lganlar: 14 ta
7. O'tgan muddatli eslatmalar: 32 ta

Bugun faol foydalanuvchilar soni 8 ta bo'lsa-da, savdo menejerlari yo'q. Yetakchilar soni ham nol, bu esa yangi imkoniyatlar yaratishda qiyinchiliklar borligini ko'rsatadi. Chaqirilishi kerak bo'lgan 14 ta mijoz va o'tgan muddatli 32 ta eslatma mavjud, bu esa jamoaning ish yukini oshirishi mumkin. Umuman olganda, bugungi natijalar jamoaning faoliyatini yaxshilash zarurligini ko'rsatmoqda.`
}

export function stringifyCimsAiValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-'
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || '-'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => stringifyCimsAiValue(entry))
      .filter((entry) => entry && entry !== '-')

    return parts.length > 0 ? parts.join(', ') : '-'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

export function extractCimsAiAnswer(response: AiChatResponse) {
  const candidates = [
    response.answer,
    response.message,
    response.response,
    response.reply,
    response.content,
    response.output,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return 'AI javobi bosh qaytdi.'
}

export function normalizeCimsAiIntents(value: unknown) {
  if (!value) {
    return [] as string[]
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim()
        }

        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>
          return stringifyCimsAiValue(record.label ?? record.name ?? record.intent ?? record.type)
        }

        return stringifyCimsAiValue(entry)
      })
      .filter((entry) => entry && entry !== '-')
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return [stringifyCimsAiValue(value)].filter((entry) => entry !== '-')
}

export function getCimsAiSignals(response?: AiChatResponse) {
  if (!response) {
    return []
  }

  const intents = normalizeCimsAiIntents(response.intents)
  const signals = [
    response.used_llm ? { label: 'Model', value: stringifyCimsAiValue(response.used_llm) } : null,
    response.period ? { label: 'Period', value: stringifyCimsAiValue(response.period) } : null,
    response.employee ? { label: 'Employee', value: stringifyCimsAiValue(response.employee) } : null,
    response.context ? { label: 'Context', value: stringifyCimsAiValue(response.context) } : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry))

  if (intents.length > 0) {
    signals.push({ label: 'Intents', value: intents.join(', ') })
  }

  return signals
}
