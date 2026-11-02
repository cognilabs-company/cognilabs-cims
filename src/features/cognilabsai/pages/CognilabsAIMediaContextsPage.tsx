import { useCallback, useState } from 'react'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { Dialog } from '../../../shared/ui/dialog'
import { IconButton } from '../../../shared/ui/icon-button'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { PageHeader } from '../../../shared/ui/page-header'
import { SectionTitle } from '../../../shared/ui/section-title'
import { Skeleton, SkeletonText } from '../../../shared/ui/skeleton'
import { StatCard } from '../../../shared/ui/stat-card'
import { EmptyStateBlock, ErrorStateBlock } from '../../../shared/ui/state-block'
import { Switch } from '../../../shared/ui/switch'
import { Tabs, type TabItem } from '../../../shared/ui/tabs'
import { Textarea } from '../../../shared/ui/textarea'
import { toneDot, toneSolid, toneSurface, toneText, type Tone } from '../../../shared/ui/tone'
import {
  cognilabsaiService,
  type MediaContextItem,
  type MediaContextCreatePayload,
} from '../../../shared/api/services/cognilabsai.service'

type MediaType = 'story' | 'post' | 'reel' | 'ad'
type FilterTab = 'all' | MediaType

const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; tone: Tone }> = {
  story: { label: 'Story', tone: 'danger' },
  post: { label: 'Post', tone: 'blue' },
  reel: { label: 'Reel', tone: 'violet' },
  ad: { label: 'Ad', tone: 'success' },
}

function getMediaConfig(mediaType: string) {
  return MEDIA_TYPE_CONFIG[mediaType as MediaType] ?? MEDIA_TYPE_CONFIG.post
}

function StoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3.5"/>
      <path d="M12 2a10 10 0 1 0 10 10"/>
      <path d="M12 6V2M6 12H2"/>
    </svg>
  )
}

function PostIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="m3 9 4-4 4 4 4-5 4 5"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
    </svg>
  )
}

function ReelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H9a7 7 0 0 0-7 7v6a7 7 0 0 0 7 7h6a7 7 0 0 0 7-7V9a7 7 0 0 0-7-7z"/>
      <path d="m10 9 5 3-5 3V9z"/>
    </svg>
  )
}

function AdIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  )
}

function MediaTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'story') return <StoryIcon className={className} />
  if (type === 'reel') return <ReelIcon className={className} />
  if (type === 'ad') return <AdIcon className={className} />
  return <PostIcon className={className} />
}

function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3z"/>
      <path d="m3 12.5 9 4.5 9-4.5"/>
      <path d="m3 17 9 4.5 9-4.5"/>
    </svg>
  )
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12h3l2.5-6 3.5 12 3-9 2 3h4"/>
    </svg>
  )
}

function EditGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

function ExternalGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  )
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function StoryCircleCard({ ctx, onView, onEdit, onDelete }: {
  ctx: MediaContextItem
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const cfg = getMediaConfig(ctx.media_type)
  return (
    <div className="group flex cursor-pointer flex-col items-center gap-2 select-none" onClick={onView}>
      <div className="relative">
        <div className={cn('h-16 w-16 rounded-full p-[2px]', ctx.is_active ? toneDot[cfg.tone] : 'bg-[var(--border-hover)]')}>
          <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--muted-surface)]">
            <MediaTypeIcon type={ctx.media_type} className={cn('h-7 w-7', toneText[cfg.tone])} />
          </div>
        </div>
        {ctx.is_active && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)] bg-[var(--success-text)]" />
        )}
        <div className="absolute -right-1 -bottom-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <IconButton
            label="Edit"
            size="sm"
            onClick={onEdit}
            className="h-6 w-6 rounded-full bg-[var(--surface)] shadow-[var(--elev-md)]"
          >
            <EditGlyph className="h-3 w-3" />
          </IconButton>
          <IconButton
            label="Delete"
            tone="danger"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 rounded-full bg-[var(--surface)] shadow-[var(--elev-md)]"
          >
            <TrashGlyph className="h-3 w-3" />
          </IconButton>
        </div>
      </div>
      <p className="max-w-[64px] truncate text-center text-[11.5px] font-medium text-[var(--foreground)]">{ctx.title}</p>
    </div>
  )
}

function MediaCard({ ctx, onView, onEdit, onDelete }: {
  ctx: MediaContextItem
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const cfg = getMediaConfig(ctx.media_type)
  const displayUrl = ctx.normalized_url || ctx.url

  return (
    <div
      className="group flex cursor-pointer flex-col gap-3 rounded-[24px] bg-[var(--card)] p-[18px] transition-colors hover:bg-[var(--card-hover)]"
      onClick={onView}
    >
      <div className={cn('relative flex h-[112px] items-center justify-center rounded-[18px]', toneSurface[cfg.tone])}>
        <div className="flex flex-col items-center gap-2">
          <span className={cn('grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--surface)]', toneText[cfg.tone])}>
            <MediaTypeIcon type={ctx.media_type} className="h-5 w-5" />
          </span>
          <span className={cn('text-[11.5px] font-semibold', toneText[cfg.tone])}>{cfg.label}</span>
        </div>
        <Badge
          variant={ctx.is_active ? 'success' : 'secondary'}
          size="sm"
          dot
          className="absolute top-2.5 right-2.5"
        >
          {ctx.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <h3 className="line-clamp-1 text-sm leading-snug font-semibold tracking-[-0.01em] text-[var(--foreground)]">{ctx.title}</h3>

        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-opacity hover:opacity-80',
            toneSurface[cfg.tone],
            toneText[cfg.tone],
          )}
          title={displayUrl}
        >
          <ExternalGlyph className="h-3 w-3 shrink-0" />
          <span className="truncate">{displayUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        </a>

        <p className="line-clamp-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{ctx.ai_description}</p>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
          <span className="text-[11.5px] text-[var(--caption)]">{formatRelativeTime(ctx.created_at)}</span>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <IconButton label="Edit" size="sm" onClick={onEdit}>
              <EditGlyph className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Delete" tone="danger" size="sm" onClick={onDelete}>
              <TrashGlyph className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}

type FormDraft = {
  media_type: MediaType
  url: string
  title: string
  ai_description: string
  is_active: boolean
}

function emptyDraft(): FormDraft {
  return { media_type: 'post', url: '', title: '', ai_description: '', is_active: true }
}

function draftFromContext(ctx: MediaContextItem): FormDraft {
  return {
    media_type: (ctx.media_type as MediaType) || 'post',
    url: ctx.url,
    title: ctx.title,
    ai_description: ctx.ai_description,
    is_active: ctx.is_active,
  }
}

const MEDIA_TYPE_OPTIONS = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'ad', label: 'Ad' },
]

const FILTER_TABS: TabItem<FilterTab>[] = [
  { value: 'all', label: 'All' },
  { value: 'story', label: 'Stories' },
  { value: 'post', label: 'Posts' },
  { value: 'reel', label: 'Reels' },
  { value: 'ad', label: 'Ads' },
]

function ViewModal({ ctx, onClose, onEdit }: {
  ctx: MediaContextItem
  onClose: () => void
  onEdit: () => void
}) {
  const cfg = getMediaConfig(ctx.media_type)
  const displayUrl = ctx.normalized_url || ctx.url

  return (
    <Dialog
      open
      onClose={onClose}
      title={ctx.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={onEdit} leftIcon={<EditGlyph className="h-4 w-4" />}>Edit</Button>
        </>
      }
    >
      <div className="space-y-[18px]">
        <div className={cn('flex items-center justify-between gap-3 rounded-[18px] p-[18px]', toneSurface[cfg.tone])}>
          <div className="flex items-center gap-3">
            <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--surface)]', toneText[cfg.tone])}>
              <MediaTypeIcon type={ctx.media_type} className="h-5 w-5" />
            </span>
            <span className={cn('text-[15px] font-semibold', toneText[cfg.tone])}>{cfg.label}</span>
          </div>
          <Badge variant={ctx.is_active ? 'success' : 'secondary'} dot>
            {ctx.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div>
          <p className="text-[12.5px] font-medium text-[var(--muted)]">Instagram Link</p>
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-2 flex w-full items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-80',
              toneSurface[cfg.tone],
              toneText[cfg.tone],
            )}
          >
            <ExternalGlyph className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{displayUrl}</span>
          </a>
        </div>

        <div>
          <p className="text-[12.5px] font-medium text-[var(--muted)]">AI Description</p>
          <div className="mt-2 rounded-[18px] bg-[var(--accent-soft)] p-[18px] text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
            {ctx.ai_description}
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function CreateEditModal({ mode, initial, onClose, onSaved }: {
  mode: 'create' | 'edit'
  initial?: MediaContextItem
  onClose: () => void
  onSaved: (ctx: MediaContextItem) => void
}) {
  const { showToast } = useToast()
  const [draft, setDraft] = useState<FormDraft>(initial ? draftFromContext(initial) : emptyDraft())
  const [isSubmitting, setIsSubmitting] = useState(false)

  function set<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.title.trim() || !draft.ai_description.trim() || !draft.url.trim()) {
      showToast({ title: 'Title, URL va AI description kerak', tone: 'error' })
      return
    }
    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        const payload: MediaContextCreatePayload = {
          media_type: draft.media_type,
          url: draft.url.trim(),
          title: draft.title.trim(),
          ai_description: draft.ai_description.trim(),
          is_active: draft.is_active,
        }
        const created = await cognilabsaiService.createMediaContext(payload)
        showToast({ title: "Context qo'shildi", tone: 'success' })
        onSaved(created)
      } else if (initial) {
        const updated = await cognilabsaiService.updateMediaContext(initial.id, {
          title: draft.title.trim(),
          ai_description: draft.ai_description.trim(),
          is_active: draft.is_active,
        })
        showToast({ title: 'Context yangilandi', tone: 'success' })
        onSaved(updated)
      }
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? "Yangi Media Context qo'shish" : 'Media Contextni tahrirlash'}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-[18px]">
        <div className="grid grid-cols-4 gap-2.5">
          {MEDIA_TYPE_OPTIONS.map((opt) => {
            const c = getMediaConfig(opt.value)
            const isSelected = draft.media_type === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('media_type', opt.value as MediaType)}
                disabled={mode === 'edit'}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-[14px] px-2 py-3 text-[12px] font-semibold transition-colors',
                  isSelected
                    ? toneSolid[c.tone]
                    : 'bg-[var(--input-surface)] text-[var(--muted)] hover:bg-[var(--input-surface-hover)] hover:text-[var(--foreground)]',
                  mode === 'edit' && 'cursor-not-allowed opacity-50',
                )}
              >
                <MediaTypeIcon type={opt.value} className="h-4 w-4" />
                {opt.label}
              </button>
            )
          })}
        </div>

        {mode === 'create' && (
          <div>
            <Label htmlFor="ctx-url">Instagram URL *</Label>
            <Input
              id="ctx-url"
              placeholder="https://www.instagram.com/reel/ABC/"
              value={draft.url}
              onChange={(e) => set('url', e.target.value)}
              className="mt-2"
            />
            <p className="mt-2 text-[12px] text-[var(--muted)]">Backend avtomatik normalize qiladi</p>
          </div>
        )}

        <div>
          <Label htmlFor="ctx-title">Title *</Label>
          <Input
            id="ctx-title"
            placeholder="CRM haqida reel"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="ctx-desc">AI Description *</Label>
          <Textarea
            id="ctx-desc"
            placeholder="Bu reel CRM tizimi haqida. AI mijozga CRM foydasini tushuntirsin va telefon raqam so'rasin."
            value={draft.ai_description}
            onChange={(e) => set('ai_description', e.target.value)}
            className="mt-2 min-h-[112px]"
          />
          <p className="mt-2 text-[12px] text-[var(--muted)]">AI shu contextni bilib mijozga javob beradi</p>
        </div>

        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--accent-soft)] px-[18px] py-3.5">
          <Switch
            checked={draft.is_active}
            onChange={(v) => set('is_active', v)}
            tone="emerald"
            label="Active"
          />
          <div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Active</p>
            <p className="text-[12px] text-[var(--muted)]">AI bu context bo'yicha javob beradi</p>
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <Button type="submit" className="flex-1" loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Saqlanmoqda...' : mode === 'create' ? "Qo'shish" : 'Saqlash'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Bekor qilish</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function CognilabsAIMediaContextsPage() {
  const { showToast } = useToast()
  const { confirm } = useConfirm()

  const [contexts, setContexts] = useState<MediaContextItem[]>([])
  const [total, setTotal] = useState(0)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(false)

  const [viewCtx, setViewCtx] = useState<MediaContextItem | null>(null)
  const [editCtx, setEditCtx] = useState<MediaContextItem | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const query = useAsyncData(
    () => cognilabsaiService.listMediaContexts({ limit: 200 }),
    [],
    {
      onSuccess: (data) => {
        setContexts(data.items)
        setTotal(data.total)
      },
    },
  )

  const filtered = contexts.filter((ctx) => {
    if (activeFilter !== 'all' && ctx.media_type !== activeFilter) return false
    if (showActiveOnly && !ctx.is_active) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return ctx.title.toLowerCase().includes(q) || ctx.ai_description.toLowerCase().includes(q) || ctx.url.toLowerCase().includes(q)
    }
    return true
  })

  const stories = filtered.filter((c) => c.media_type === 'story')
  const nonStories = filtered.filter((c) => c.media_type !== 'story')

  const statsByType = {
    story: contexts.filter((c) => c.media_type === 'story').length,
    post: contexts.filter((c) => c.media_type === 'post').length,
    reel: contexts.filter((c) => c.media_type === 'reel').length,
    ad: contexts.filter((c) => c.media_type === 'ad').length,
  }
  const activeCount = contexts.filter((c) => c.is_active).length

  const handleDelete = useCallback(async (ctx: MediaContextItem) => {
    const approved = await confirm({
      title: "O'chirishni tasdiqlang",
      description: `"${ctx.title}" media contextni o'chirasizmi?`,
      tone: 'danger',
      confirmLabel: "O'chirish",
    })
    if (!approved) return
    try {
      await cognilabsaiService.deleteMediaContext(ctx.id)
      setContexts((prev) => prev.filter((c) => c.id !== ctx.id))
      setTotal((t) => t - 1)
      if (viewCtx?.id === ctx.id) setViewCtx(null)
      showToast({ title: "O'chirildi", tone: 'success' })
    } catch (err) {
      showToast({ title: 'Xatolik', description: getApiErrorMessage(err), tone: 'error' })
    }
  }, [confirm, showToast, viewCtx])

  function handleSaved(ctx: MediaContextItem) {
    setContexts((prev) => {
      const exists = prev.some((c) => c.id === ctx.id)
      if (exists) return prev.map((c) => (c.id === ctx.id ? ctx : c))
      return [ctx, ...prev]
    })
    if (!contexts.some((c) => c.id === ctx.id)) setTotal((t) => t + 1)
    setIsCreating(false)
    setEditCtx(null)
  }

  const showStoryRow = (activeFilter === 'all' || activeFilter === 'story') && stories.length > 0

  const statTiles: { label: string; value: number; tone: Tone; icon: React.ReactNode; solid?: boolean }[] = [
    { label: 'Jami', value: total, tone: 'blue', icon: <LibraryIcon className="h-[18px] w-[18px]" />, solid: true },
    { label: 'Faol', value: activeCount, tone: 'success', icon: <PulseIcon className="h-[18px] w-[18px]" /> },
    { label: 'Stories', value: statsByType.story, tone: 'danger', icon: <MediaTypeIcon type="story" className="h-[18px] w-[18px]" /> },
    { label: 'Posts', value: statsByType.post, tone: 'blue', icon: <MediaTypeIcon type="post" className="h-[18px] w-[18px]" /> },
    { label: 'Reels', value: statsByType.reel, tone: 'violet', icon: <MediaTypeIcon type="reel" className="h-[18px] w-[18px]" /> },
  ]

  return (
    <div className="space-y-[18px]">
      <PageHeader
        title="Instagram Media Contexts"
        description="AI uchun story, post va reel kontekstlarini boshqaring"
        actions={
          <Button
            onClick={() => setIsCreating(true)}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            }
          >
            Yangi Context
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 xl:grid-cols-5">
        {statTiles.map((tile) => (
          <StatCard
            key={tile.label}
            label={tile.label}
            value={tile.value}
            icon={tile.icon}
            iconTone={tile.tone}
            solid={tile.solid}
          />
        ))}
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-[18px]">
        <Tabs items={FILTER_TABS} value={activeFilter} onChange={setActiveFilter} />

        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 min-h-9 rounded-[11px] pl-9 text-[13px]"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowActiveOnly((v) => !v)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[11px] px-3.5 text-[12.5px] font-semibold transition-colors',
            showActiveOnly
              ? 'bg-[var(--success-dim)] text-[var(--success-text)]'
              : 'bg-[var(--input-surface)] text-[var(--muted)] hover:bg-[var(--input-surface-hover)] hover:text-[var(--foreground)]',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', showActiveOnly ? 'bg-[var(--success-text)]' : 'bg-[var(--muted)]')} />
          Faol
        </button>
      </Card>

      {query.isLoading ? (
        <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-[24px] bg-[var(--card)] p-[18px]">
              <Skeleton rounded="xl" className="h-[112px] w-full" />
              <SkeletonText lines={3} className="mt-3.5" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorStateBlock
          eyebrow="Xatolik"
          title="Ma'lumotlarni yuklashda xatolik"
          actionLabel="Qayta urinish"
          onAction={() => void query.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyStateBlock
          eyebrow="Instagram Media Contexts"
          title="Kontekst topilmadi"
          description={contexts.length === 0 ? "Birinchi media contextni qo'shing" : 'Filter shartlariga mos kontekst yo\'q'}
        >
          {contexts.length === 0 ? (
            <Button onClick={() => setIsCreating(true)}>
              Birinchi contextni qo'shish
            </Button>
          ) : null}
        </EmptyStateBlock>
      ) : (
        <div className="space-y-[18px]">
          {showStoryRow && (
            <Card className="space-y-4">
              <SectionTitle title="Stories" />
              <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1">
                {stories.map((ctx) => (
                  <div key={ctx.id} className="shrink-0">
                    <StoryCircleCard
                      ctx={ctx}
                      onView={() => setViewCtx(ctx)}
                      onEdit={() => setEditCtx(ctx)}
                      onDelete={() => void handleDelete(ctx)}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {nonStories.length > 0 && (
            <div className="space-y-[18px]">
              {showStoryRow && nonStories.length > 0 && (
                <SectionTitle title="Posts & Reels & Ads" />
              )}
              <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-4">
                {nonStories.map((ctx) => (
                  <MediaCard
                    key={ctx.id}
                    ctx={ctx}
                    onView={() => setViewCtx(ctx)}
                    onEdit={() => setEditCtx(ctx)}
                    onDelete={() => void handleDelete(ctx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewCtx && !editCtx && (
        <ViewModal
          ctx={viewCtx}
          onClose={() => setViewCtx(null)}
          onEdit={() => { setEditCtx(viewCtx); setViewCtx(null) }}
        />
      )}

      {(isCreating || editCtx) && (
        <CreateEditModal
          mode={isCreating ? 'create' : 'edit'}
          initial={editCtx ?? undefined}
          onClose={() => { setIsCreating(false); setEditCtx(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
