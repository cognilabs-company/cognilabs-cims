import { env } from '../../../shared/config/env'

export function resolveCustomerAudioUrl(audioFileId?: string | null, audioUrl?: string | null, apiBasePath = '/crm') {
  if (audioUrl) {
    return audioUrl
  }

  if (!audioFileId) {
    return null
  }

  return `${env.apiBaseUrl.replace(/\/$/, '')}${apiBasePath}/customers/audio/${audioFileId}`
}
