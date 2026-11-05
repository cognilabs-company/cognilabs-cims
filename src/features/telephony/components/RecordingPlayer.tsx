import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../../shared/ui/button'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { telephonyService } from '../../../shared/api/services/telephony.service'

export function RecordingPlayer({ callId }: { callId: number }) {
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

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading recording...</p>
  if (error) return <p role="alert" className="text-sm text-[var(--danger-text)]">{error}</p>
  if (!url) return null

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <audio className="min-w-0 flex-1" src={url} controls preload="metadata" />
      <Button asChild variant="secondary" size="sm"><a href={url} download={`call-${callId}.${extension}`}><Download size={15} aria-hidden="true" /><span className="ml-2">Download</span></a></Button>
    </div>
  )
}
