import { request } from '../http'
import { getAccessToken } from '../../lib/session'
import { env } from '../../config/env'
import type { SuccessResponse } from '../types'

export type ConversationItem = {
  id: number
  channel: string
  chat_mode: 'telegram_operator' | 'instagram_ai' | string
  supports_ai: boolean
  crm_customer_id?: number | null
  client_external_id: string
  client_username: string | null
  client_full_name: string | null
  client_display_name: string | null
  client_avatar_url: string | null
  instagram_business_id: string | null
  ai_enabled: boolean
  unread_count: number
  telegram_is_online: boolean | null
  telegram_presence_status: 'online' | 'offline' | 'recently' | 'last_week' | 'last_month' | string | null
  telegram_last_seen_at: string | null
  pause_reason: string | null
  paused_until: string | null
  last_message_at: string | null
  last_message_preview: string | null
  last_operator_user_id: number | null
  last_operator_name: string | null
  follow_up_enabled: boolean | null
  follow_up_mode: 'global' | 'custom' | string | null
  follow_up_delay_minutes: number | null
  follow_up_message: string | null
  follow_up_due_at: string | null
  follow_up_sent_at: string | null
  default_follow_up_last_step: number | null
  default_follow_up_due_at: string | null
  default_follow_up_last_sent_at: string | null
  ai_stage: string | null
  ai_stage_label: string | null
  ai_interest: string | null
  instagram_media_context_id: number | null
  ai_follow_up_due_at: string | null
  ai_follow_up_sent_at: string | null
  lead_phone_number: string | null
  lead_full_name: string | null
  lead_business_field: string | null
  lead_scheduled_time: string | null
  is_imported: boolean
  created_at: string
  updated_at: string
}

export type MediaContextItem = {
  id: number
  media_type: 'story' | 'post' | 'reel' | 'ad' | string
  url: string
  normalized_url: string
  media_id: string | null
  story_id: string | null
  title: string
  ai_description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MediaContextCreatePayload = {
  media_type: 'story' | 'post' | 'reel' | 'ad'
  url: string
  media_id?: string | null
  story_id?: string | null
  title: string
  ai_description: string
  is_active: boolean
}

export type MediaContextUpdatePayload = {
  title?: string
  ai_description?: string
  is_active?: boolean
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  limit: number
  offset: number
}

export type MessageItem = {
  id: number
  conversation_id: number
  channel: string
  sender_type: 'client' | 'operator' | 'ai' | 'system'
  operator_user_id: number | null
  operator_name_snapshot: string | null
  client_external_id: string | null
  instagram_message_id: string | null
  telegram_message_id: string | null
  media_type?: 'sticker' | 'animated_sticker' | 'video_sticker' | string | null
  media_url?: string | null
  text: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export type TelegramSearchResult = {
  peer: string
  external_id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  existing_conversation_id: number | null
  is_online: boolean | null
  presence_status: 'online' | 'offline' | 'recently' | 'last_week' | 'last_month' | string | null
  last_seen_at: string | null
}

export type TelegramSearchListResponse = {
  query: string
  items: TelegramSearchResult[]
}

export type IntegrationConfig = {
  openai_api_key: string | null
  openai_model: string | null
  openai_base_url: string | null
  system_prompt: string | null
  instagram_access_token: string | null
  instagram_business_id: string | null
  instagram_verify_token: string | null
  telegram_api_id: string | null
  telegram_api_hash: string | null
  telegram_session: string | null
  websocket_api_key: string | null
  frontend_base_url: string | null
  cognilabs_telegram_token?: string | null
  cognilabs_channel_id?: string | null
  instagram_followup_enabled?: boolean | null
  instagram_followup_delay_minutes?: number | null
  instagram_followup_message?: string | null
  telegram_followup_enabled?: boolean | null
  telegram_followup_delay_minutes?: number | null
  telegram_followup_message?: string | null
  instagram_default_followup_step1_delay_minutes?: number | null
  instagram_default_followup_step1_message?: string | null
  instagram_default_followup_step2_delay_minutes?: number | null
  instagram_default_followup_step2_message?: string | null
  instagram_default_followup_step3_delay_minutes?: number | null
  instagram_default_followup_step3_message?: string | null
  id?: number
  created_at?: string
  updated_at?: string
}

export type IntegrationConfigPayload = Omit<IntegrationConfig, 'id' | 'created_at' | 'updated_at'>

export type FollowUpMode = 'global' | 'custom'

export type ConversationFollowUpPayload = {
  enabled: boolean
  mode?: FollowUpMode
  delay_minutes?: number | null
  message?: string | null
}

export type ImportConversationsResponse = {
  imported_files: number
  skipped_files: number
  created_conversations: number
  created_messages: number
  source_type: string
}

export type WsEvent =
  | { type: 'message.created'; conversation_id: number; message: MessageItem }
  | { type: 'conversation.updated'; conversation_id: number; conversation: ConversationItem }

export const cognilabsaiService = {
  listConversations(channel?: string | null, limit = 50, offset = 0) {
    return request<PaginatedResponse<ConversationItem>>({
      path: '/cognilabsai/chat/conversations',
      query: { ...(channel != null ? { channel } : {}), limit, offset },
    })
  },

  getConversation(conversationId: number) {
    return request<ConversationItem>({
      path: `/cognilabsai/chat/conversations/${conversationId}`,
    })
  },

  listMessages(conversationId: number, limit = 200, offset = 0) {
    return request<MessageItem[]>({
      path: `/cognilabsai/chat/conversations/${conversationId}/messages`,
      query: { limit, offset },
    })
  },

  sendMessage(conversationId: number, text: string) {
    return request<string>({
      path: '/cognilabsai/chat/send-message',
      method: 'POST',
      body: { conversation_id: conversationId, text },
    })
  },

  pause(conversationId: number) {
    return request<ConversationItem>({
      path: '/cognilabsai/chat/pause',
      method: 'POST',
      body: { conversation_id: conversationId },
    })
  },

  resume(conversationId: number) {
    return request<ConversationItem>({
      path: '/cognilabsai/chat/resume',
      method: 'POST',
      body: { conversation_id: conversationId },
    })
  },

  pauseUntil(conversationId: number, pausedUntil: string) {
    return request<ConversationItem>({
      path: '/cognilabsai/chat/pause-until',
      method: 'POST',
      body: { conversation_id: conversationId, paused_until: pausedUntil },
    })
  },

  retryAi(conversationId: number) {
    return request<{ message: string }>({
      path: `/cognilabsai/chat/conversations/${conversationId}/retry-ai`,
      method: 'POST',
    })
  },

  updateConversationFollowUp(conversationId: number, payload: ConversationFollowUpPayload) {
    return request<ConversationItem>({
      path: `/cognilabsai/chat/conversations/${conversationId}/follow-up`,
      method: 'PATCH',
      body: payload,
    })
  },

  telegramSearch(query: string) {
    return request<TelegramSearchResult>({
      path: '/cognilabsai/chat/telegram/search',
      query: { query },
    })
  },

  telegramSearchList(query: string, limit = 10) {
    return request<TelegramSearchListResponse>({
      path: '/cognilabsai/chat/telegram/search-list',
      query: { query, limit },
    })
  },

  telegramStart(peer: string, text: string, clientFullName?: string) {
    return request<string>({
      path: '/cognilabsai/chat/telegram/start',
      method: 'POST',
      body: { peer, text, client_full_name: clientFullName },
    })
  },

  getIntegrations() {
    return request<IntegrationConfig>({
      path: '/cognilabsai/integrations',
    })
  },

  updateIntegrations(payload: IntegrationConfigPayload) {
    return request<IntegrationConfig>({
      path: '/cognilabsai/integrations',
      method: 'PATCH',
      body: payload,
    })
  },

  createWebSocket(wsKey: string, conversationId?: number): WebSocket {
    const baseUrl = env.apiBaseUrl.replace(/^http/, 'ws').replace(/\/$/, '')
    let url = `${baseUrl}/cognilabsai/ws/chat?api_key=${wsKey}`
    if (conversationId !== undefined) {
      url += `&conversation_id=${conversationId}`
    }
    return new WebSocket(url)
  },

  buildAvatarUrl(avatarPath: string | null) {
    if (!avatarPath) return null
    if (avatarPath.startsWith('http')) return avatarPath
    return `${env.apiBaseUrl.replace(/\/$/, '')}${avatarPath}`
  },

  listMediaContexts(params?: { limit?: number; offset?: number; active?: boolean }) {
    return request<PaginatedResponse<MediaContextItem>>({
      path: '/cognilabsai/chat/instagram/media-contexts',
      query: {
        limit: params?.limit ?? 50,
        offset: params?.offset ?? 0,
        ...(params?.active !== undefined ? { active: params.active } : {}),
      },
    })
  },

  getMediaContext(id: number) {
    return request<MediaContextItem>({
      path: `/cognilabsai/chat/instagram/media-contexts/${id}`,
    })
  },

  createMediaContext(payload: MediaContextCreatePayload) {
    return request<MediaContextItem>({
      path: '/cognilabsai/chat/instagram/media-contexts',
      method: 'POST',
      body: payload,
    })
  },

  updateMediaContext(id: number, payload: MediaContextUpdatePayload) {
    return request<MediaContextItem>({
      path: `/cognilabsai/chat/instagram/media-contexts/${id}`,
      method: 'PATCH',
      body: payload,
    })
  },

  deleteMediaContext(id: number) {
    return request<SuccessResponse>({
      path: `/cognilabsai/chat/instagram/media-contexts/${id}`,
      method: 'DELETE',
    })
  },

  deleteConversation(conversationId: number) {
    return request<SuccessResponse>({
      path: `/cognilabsai/chat/conversations/${conversationId}`,
      method: 'DELETE',
    })
  },

  listAiStages() {
    return request<Array<{ value: string; label: string; color?: string | null; order?: number | null }>>({
      path: '/cognilabsai/chat/ai-stages',
    })
  },
}

export function getWsKeyFromStorage(): string | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const stored = sessionStorage.getItem('cognilabsai:ws_key')
    return stored
  } catch {
    return null
  }
}

export function setWsKeyInStorage(key: string) {
  try {
    sessionStorage.setItem('cognilabsai:ws_key', key)
  } catch {
    // ignore
  }
}
