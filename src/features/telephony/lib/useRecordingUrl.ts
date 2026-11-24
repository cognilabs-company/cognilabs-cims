import { useEffect, useState } from 'react'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { telephonyService } from '../../../shared/api/services/telephony.service'

/** The call recording as an object URL (the audio comes as an authorised blob, so it plays from memory). */
export function useRecordingUrl(callId: number) {
  const [url, setUrl] = useState<string | null>(null)
  const [extension, setExtension] = useState('webm')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void telephonyService.recording(callId).then((blob) => {
      if (active) {
        setExtension(blob.type.includes('mpeg') ? 'mp3' : blob.type.includes('wav') ? 'wav' : blob.type.includes('ogg') ? 'ogg' : 'webm')
        setUrl(URL.createObjectURL(blob))
      }
    }).catch((cause: unknown) => { if (active) setError(getApiErrorMessage(cause)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [callId])

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return { url, extension, loading, error }
}
