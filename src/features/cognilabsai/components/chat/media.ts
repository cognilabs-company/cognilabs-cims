import type { MessageAttachment, MessageItem } from '../../../../shared/api/services/cognilabsai.service'
import { resolveMediaUrl } from '../../../../shared/lib/media-url'
import { isStickerMediaType } from './chatUtils'

/* Everything a client (or the operator / AI) sends besides plain text: photos, videos, voice
   messages, audio, files and shared Instagram posts / reels / stories. Media comes from
   `attachments` (new backend), `media_type` + `media_url` (older messages) or, for Instagram
   shares, from the lines the backend writes into the message text. */

export type MediaKind = 'image' | 'video' | 'voice' | 'audio' | 'file' | 'post' | 'reel' | 'story' | 'video_note'

export type MediaPiece = {
  key: string
  kind: MediaKind
  url: string | null
  thumbnail: string | null
  title: string | null
  mime: string | null
  /** Instagram link of a shared post / reel / story. */
  link: string | null
  /** The AI note the backend attached to a shared post. */
  note: string | null
}

function kindOf(type: string | null | undefined, mime?: string | null, url?: string | null): MediaKind | null {
  const key = (type ?? '').toLowerCase()
  if (!key && !mime && !url) return null
  if (key.includes('voice') || key === 'ptt') return 'voice'
  if (key.includes('video_note') || key.includes('round')) return 'video_note'
  if (key.includes('reel') || key === 'ig_reel' || key === 'clip') return 'reel'
  if (key.includes('story')) return 'story'
  if (key.includes('share') || key.includes('post') || key === 'feed' || key === 'carousel' || key === 'carousel_album' || key === 'media_share') return 'post'
  if (key.includes('audio') || key === 'music') return 'audio'
  if (key.includes('video') || key === 'animation' || key === 'gif') return 'video'
  if (key.includes('image') || key.includes('photo') || key === 'picture') return 'image'
  if (key.includes('file') || key.includes('document') || key === 'pdf') return 'file'
  const m = (mime ?? '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return m.includes('ogg') || m.includes('opus') ? 'voice' : 'audio'
  if (m) return 'file'
  if (url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)) return 'image'
  if (url && /\.(mp4|mov|webm)(\?|$)/i.test(url)) return 'video'
  // Media a client sent in an Instagram DM (lookaside.fbsbx.com/ig_messaging_cdn…) comes without a mime type: it is shown
  // as a photo first and the bubble switches to a video player when the image does not load (see TgMedia ImagePiece).
  if (url && /(lookaside\.fbsbx\.com|cdninstagram\.com|fbcdn\.net)/i.test(url)) return 'image'
  return 'file'
}

/** Lines the backend adds to the text of an Instagram share (see docs/COGNILABSAI_FRONTEND_MEDIA_AI.md §6). */
const SHARE_HEADER = /^(Mijoz Instagram .*yozdi\.?|Client wrote about an Instagram .*)$/i
const SHARE_LINK = /^(?:Instagram media link|Instagram link|Media link):\s*(\S+)\s*$/i
const SHARE_TITLE = /^(?:Media nomi|Media title):\s*(.+)$/i
const SHARE_NOTE = /^(?:AI media izohi|AI note):\s*(.+)$/i
/** "[Voice message]", "[Photo]", "[Video]"… placeholders some channels send instead of text. */
const PLACEHOLDER = /^\[(voice(?: message)?|audio|photo|image|video|video note|file|document|gif|animation|reel|story|post|shared post|media)[^\]]*\]$/i

/** Attachment rows that only describe the message itself (live data: `message`, `comment`, url null). */
const NON_MEDIA_TYPES = new Set(['message', 'text', 'comment', 'reply'])
const INSTAGRAM_LINK = /^https?:\/\/(www\.)?instagram\.com\//i

function shareKind(link: string): MediaKind {
  if (/\/reels?\//i.test(link)) return 'reel'
  if (/\/stories\//i.test(link)) return 'story'
  return 'post'
}

export function extractMedia(msg: MessageItem): { pieces: MediaPiece[]; text: string; placeholder: MediaKind | null } {
  const pieces: MediaPiece[] = []
  const attachments = [...(msg.attachments ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  // The backend has no uniqueness on attachments, so the same media can arrive twice; show it once.
  const seen = new Set<string>()
  attachments.forEach((item: MessageAttachment, index) => {
    if (isStickerMediaType(item.attachment_type)) return
    const identity = item.url ?? item.media_id ?? item.thumbnail_url
    if (identity) {
      if (seen.has(identity)) return
      seen.add(identity)
    }
    const type = (item.attachment_type ?? '').toLowerCase()
    if (NON_MEDIA_TYPES.has(type) && !item.url) return
    if (!item.url && !item.thumbnail_url && !item.media_id) return
    // `media_send` = a post / reel the client shared; the url is the Instagram link.
    const kind = item.url && INSTAGRAM_LINK.test(item.url) ? shareKind(item.url) : kindOf(item.attachment_type, item.mime_type, item.url)
    if (!kind) return
    const url = resolveMediaUrl(item.url)
    const isShare = kind === 'post' || kind === 'reel' || kind === 'story'
    pieces.push({
      key: `a-${item.id ?? index}`,
      kind,
      url: isShare ? null : url,
      thumbnail: resolveMediaUrl(item.thumbnail_url),
      title: item.title ?? null,
      mime: item.mime_type ?? null,
      link: isShare ? (item.url ?? null) : null,
      note: null,
    })
  })

  // Older messages: one media item on the message itself.
  if (!pieces.length && msg.media_type && !isStickerMediaType(msg.media_type) && msg.media_url) {
    const kind = INSTAGRAM_LINK.test(msg.media_url) ? shareKind(msg.media_url) : kindOf(msg.media_type, null, msg.media_url)
    if (kind) {
      const isShare = kind === 'post' || kind === 'reel' || kind === 'story'
      pieces.push({ key: 'm', kind, url: isShare ? null : resolveMediaUrl(msg.media_url), thumbnail: null, title: null, mime: null, link: isShare ? msg.media_url : null, note: null })
    }
  }

  // Instagram shares written into the text: turn them into a card and keep only what the client wrote.
  const lines = (msg.text ?? '').split('\n')
  let link: string | null = null
  let title: string | null = null
  let note: string | null = null
  const kept = lines.filter((line) => {
    const value = line.trim()
    const linkMatch = value.match(SHARE_LINK)
    if (linkMatch) { link = linkMatch[1]; return false }
    const titleMatch = value.match(SHARE_TITLE)
    if (titleMatch) { title = titleMatch[1].trim(); return false }
    const noteMatch = value.match(SHARE_NOTE)
    if (noteMatch) { note = noteMatch[1].trim(); return false }
    return !SHARE_HEADER.test(value)
  })
  if (link) {
    const target: string = link
    // The same media can come both as an attachment and as a "Media link:" line; show it once.
    const known = pieces.find((piece) => piece.link === target || piece.url === resolveMediaUrl(target) || piece.url === target)
    if (known) Object.assign(known, { title: known.title ?? title, note })
    else if (INSTAGRAM_LINK.test(target)) pieces.push({ key: 'share', kind: shareKind(target), url: null, thumbnail: null, title, mime: null, link: target, note })
    else {
      const kind = kindOf(null, null, target) ?? 'file'
      pieces.push({ key: 'share', kind, url: resolveMediaUrl(target), thumbnail: null, title, mime: null, link: null, note })
    }
  }
  let text = link || title || note ? kept.join('\n').trim() : (msg.text ?? '')

  // "[Voice message]" with nothing to play: say so instead of showing the raw placeholder.
  let placeholder: MediaKind | null = null
  const bare = text.trim()
  if (PLACEHOLDER.test(bare)) {
    const kind = kindOf(bare.replace(/[[\]]/g, '').replace(/\s+/g, '_'))
    if (pieces.length) text = ''
    else if (kind) { placeholder = kind; text = '' }
  }
  return { pieces, text, placeholder }
}


/** i18n key + English fallback of each kind of media. */
export const MEDIA_LABELS: Record<MediaKind, { key: string; fallback: string }> = {
  image: { key: 'chat.media.photo', fallback: 'Photo' },
  video: { key: 'chat.media.video', fallback: 'Video' },
  video_note: { key: 'chat.media.video_note', fallback: 'Video message' },
  voice: { key: 'chat.media.voice', fallback: 'Voice message' },
  audio: { key: 'chat.media.audio', fallback: 'Audio' },
  file: { key: 'chat.media.file', fallback: 'File' },
  post: { key: 'chat.media.post', fallback: 'Instagram post' },
  reel: { key: 'chat.media.reel', fallback: 'Instagram reel' },
  story: { key: 'chat.media.story', fallback: 'Instagram story' },
}

/** Chat list preview: "[Voice message]" → "🎤 Voice message", an Instagram share → "🎞 Instagram reel". */
export function mediaPreview(preview: string | null | undefined, t: (key: string, fallback: string) => string): string | null {
  const text = (preview ?? '').trim()
  if (!text) return null
  const icons: Partial<Record<MediaKind, string>> = { voice: '🎤', audio: '🎵', image: '🖼', video: '🎬', video_note: '🎬', file: '📎', post: '📷', reel: '🎞', story: '⭕' }
  const link = text.match(/instagram\.com\/\S+/i)?.[0]
  if (link && /Instagram media link|Mijoz Instagram/i.test(text)) {
    const kind = shareKind(link)
    const rest = text.split('\n').map((line) => line.trim()).find((line) => line && !SHARE_HEADER.test(line) && !SHARE_LINK.test(line) && !SHARE_TITLE.test(line) && !SHARE_NOTE.test(line))
    const label = `${icons[kind]} ${t(MEDIA_LABELS[kind].key, MEDIA_LABELS[kind].fallback)}`
    return rest ? `${label} · ${rest}` : label
  }
  if (PLACEHOLDER.test(text)) {
    const kind = kindOf(text.replace(/[[\]]/g, '').replace(/\s+/g, '_'))
    if (kind) return `${icons[kind] ?? ''} ${t(MEDIA_LABELS[kind].key, MEDIA_LABELS[kind].fallback)}`.trim()
  }
  return text
}
