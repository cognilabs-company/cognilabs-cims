import { request } from '../http'
import type { AiChatRequest, AiChatResponse } from '../types'

export const aiService = {
  chat(payload: AiChatRequest) {
    return request<AiChatResponse>({
      path: '/ai/chat',
      method: 'POST',
      body: payload,
    })
  },
}
