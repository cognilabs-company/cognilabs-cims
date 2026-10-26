import { useCallback, useState } from 'react'
import { useToast } from '../../../shared/toast/useToast'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getApiErrorMessage } from '../../../shared/lib/api-error'
import { cn } from '../../../shared/lib/cn'
import { Button } from '../../../shared/ui/button'
import { Input } from '../../../shared/ui/input'
import { Textarea } from '../../../shared/ui/textarea'
import { Switch } from '../../../shared/ui/switch'
import { Dialog } from '../../../shared/ui/dialog'
import { Label } from '../../../shared/ui/label'
import {
  cognilabsaiService,
  type MediaContextItem,
  type MediaContextCreatePayload,
} from '../../../shared/api/services/cognilabsai.service'

type MediaType = 'story' | 'post' | 'reel' | 'ad'
type FilterTab = 'all' | MediaType

const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; gradient: string; gradientFrom: string; gradientTo: string; textColor: string; bgColor: string; borderColor: string }> = {
  story: {
    label: 'Story',
    gradient: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
    gradientFrom: '#f09433',
    gradientTo: '#bc1888',
    textColor: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
  },
  post: {
    label: 'Post',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    gradientFrom: '#3b82f6',
    gradientTo: '#6366f1',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  reel: {
    label: 'Reel',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
    gradientFrom: '#7c3aed',
    gradientTo: '#db2777',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  ad: {
    label: 'Ad',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
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
    <div className="flex flex-col items-center gap-2 group cursor-pointer select-none" onClick={onView}>
      <div className="relative">
        <div
          className="h-16 w-16 rounded-full p-[2px]"
          style={{ background: ctx.is_active ? cfg.gradient : 'var(--border)' }}
        >
          <div className="h-full w-full rounded-full bg-[var(--surface)] flex items-center justify-center">
            <MediaTypeIcon type={ctx.media_type} className={cn('h-7 w-7', cfg.textColor)} />
          </div>
        </div>
        {ctx.is_active && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[var(--background)]" />
        )}
        <div className="absolute -bottom-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={onEdit} title="Edit" className="h-5 w-5 flex items-center justify-center rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" onClick={onDelete} title="Delete" className="h-5 w-5 flex items-center justify-center rounded-full bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--muted)] hover:text-red-500 transition-colors shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>
      <p className="text-[11px] text-center text-[var(--foreground)] font-medium max-w-[64px] truncate">{ctx.title}</p>
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
  const isReel = ctx.media_type === 'reel'

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-[var(--surface)] overflow-hidden transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-lg cursor-pointer',
        cfg.borderColor,
        isReel ? 'flex flex-col' : '',
      )}
      onClick={onView}
    >
      {/* Gradient accent top */}
      <div className="h-1 w-full" style={{ background: cfg.gradient }} />

      {/* Media preview area */}
      <div className={cn(
        'relative flex items-center justify-center overflow-hidden',
        isReel ? 'h-32' : 'h-28',
        cfg.bgColor,
      )}>
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: cfg.gradient }}
          >
            <MediaTypeIcon type={ctx.media_type} className="h-6 w-6 text-white" />
          </div>
          <span className={cn('text-[10px] font-bold uppercase tracking-widest', cfg.textColor)}>{cfg.label}</span>
        </div>
        {/* Status dot */}
        <div className={cn(
          'absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
          ctx.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[var(--muted-surface)] text-[var(--muted)]',
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', ctx.is_active ? 'bg-emerald-400' : 'bg-[var(--muted)]')} />
          {ctx.is_active ? 'Active' : 'Inactive'}
        </div>
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-[13px] text-[var(--foreground)] leading-snug line-clamp-1">{ctx.title}</h3>

        <a
          href={ctx.normalized_url || ctx.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] rounded-lg px-2 py-1 font-medium transition-colors truncate max-w-full',
            cfg.textColor, cfg.bgColor, 'hover:opacity-80',
          )}
          title={ctx.normalized_url || ctx.url}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 shrink-0">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <span className="truncate">{(ctx.normalized_url || ctx.url).replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
        </a>

        <p className="text-[12px] text-[var(--muted)] leading-relaxed line-clamp-2">{ctx.ai_description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 mt-auto border-t border-[var(--border)]">
          <span className="text-[10px] text-[var(--caption)]">{formatRelativeTime(ctx.created_at)}</span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" title="Edit" onClick={onEdit} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" title="Delete" onClick={onDelete} className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
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

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'story', label: 'Stories' },
  { key: 'post', label: 'Posts' },
  { key: 'reel', label: 'Reels' },
  { key: 'ad', label: 'Ads' },
]

function ViewModal({ ctx, onClose, onEdit }: {
  ctx: MediaContextItem
  onClose: () => void
  onEdit: () => void
}) {
  const cfg = getMediaConfig(ctx.media_type)
  return (
    <Dialog open onClose={onClose} title={ctx.title}>
      <div className="space-y-4">
        {/* Media type banner */}
        <div className="relative h-24 rounded-xl overflow-hidden flex items-center justify-center" style={{ background: cfg.gradient }}>
          <MediaTypeIcon type={ctx.media_type} className="h-12 w-12 text-white opacity-30" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <MediaTypeIcon type={ctx.media_type} className="h-8 w-8 text-white" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">{cfg.label}</span>
          </div>
          <div className={cn(
            'absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            ctx.is_active ? 'bg-emerald-500/30 text-emerald-100' : 'bg-black/30 text-white/60',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', ctx.is_active ? 'bg-emerald-400' : 'bg-white/40')} />
            {ctx.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>

        {/* URL */}
        <div>
          <p className="text-[11px] text-[var(--caption)] uppercase tracking-wide mb-1">Instagram Link</p>
          <a
            href={ctx.normalized_url || ctx.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium rounded-lg px-3 py-2 w-full', cfg.textColor, cfg.bgColor, 'hover:opacity-80 transition-opacity')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span className="truncate">{ctx.normalized_url || ctx.url}</span>
          </a>
        </div>

        {/* AI Description */}
        <div>
          <p className="text-[11px] text-[var(--caption)] uppercase tracking-wide mb-1">AI Description</p>
          <div className="rounded-xl bg-[var(--accent-soft)] p-3 text-[13px] text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
            {ctx.ai_description}
          </div>
        </div>


        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={onEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 mr-1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </Button>
          <Button variant="ghost" onClick={onClose} className="flex-1">Close</Button>
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

  const cfg = getMediaConfig(draft.media_type)

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? "Yangi Media Context qo'shish" : 'Media Contextni tahrirlash'}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* Media type selector */}
        <div className="grid grid-cols-4 gap-2">
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
                  'flex flex-col items-center gap-1.5 rounded-xl border py-3 px-2 transition-all text-[11px] font-semibold',
                  isSelected
                    ? cn('border-transparent text-white', c.bgColor)
                    : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--foreground)]',
                  mode === 'edit' && 'opacity-50 cursor-not-allowed',
                )}
                style={isSelected ? { background: c.gradient } : undefined}
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
              className="mt-1"
            />
            <p className="text-[11px] text-[var(--caption)] mt-1">Backend avtomatik normalize qiladi</p>
          </div>
        )}

        <div>
          <Label htmlFor="ctx-title">Title *</Label>
          <Input
            id="ctx-title"
            placeholder="CRM haqida reel"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="ctx-desc">AI Description *</Label>
          <Textarea
            id="ctx-desc"
            placeholder="Bu reel CRM tizimi haqida. AI mijozga CRM foydasini tushuntirsin va telefon raqam so'rasin."
            value={draft.ai_description}
            onChange={(e) => set('ai_description', e.target.value)}
            className="mt-1 min-h-[100px]"
          />
          <p className="text-[11px] text-[var(--caption)] mt-1">AI shu contextni bilib mijozga javob beradi</p>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3 rounded-xl bg-[var(--accent-soft)] px-4 py-3">
          <Switch
            checked={draft.is_active}
            onChange={(v) => set('is_active', v)}
            tone="emerald"
            label="Active"
          />
          <div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Active</p>
            <p className="text-[11px] text-[var(--caption)]">AI bu context bo'yicha javob beradi</p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={isSubmitting}
            style={{ background: isSubmitting ? undefined : cfg.gradient, border: 'none' }}
          >
            {isSubmitting ? 'Saqlanmoqda...' : mode === 'create' ? "Qo'shish" : 'Saqlash'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Bekor qilish</Button>
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">Instagram Media Contexts</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">AI uchun story, post va reel kontekstlarini boshqaring</p>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', border: 'none' }}
          className="text-white font-semibold"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Yangi Context
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Jami', value: total, color: 'text-[var(--foreground)]', bg: 'bg-[var(--surface)]', border: 'border-[var(--border)]' },
          { label: 'Faol', value: activeCount, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
          { label: 'Stories', value: statsByType.story, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
          { label: 'Posts', value: statsByType.post, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
          { label: 'Reels', value: statsByType.reel, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border px-4 py-3 flex flex-col gap-1', s.bg, s.border)}>
            <span className={cn('text-2xl font-bold', s.color)}>{s.value}</span>
            <span className="text-[11px] text-[var(--caption)] uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all',
                activeFilter === tab.key
                  ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--foreground)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--caption)]">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-[13px]"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowActiveOnly((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all',
            showActiveOnly
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', showActiveOnly ? 'bg-emerald-400' : 'bg-[var(--muted)]')} />
          Faol
        </button>
      </div>

      {/* Content */}
      {query.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden animate-pulse">
              <div className="h-1 bg-[var(--accent-soft)]" />
              <div className="h-28 bg-[var(--accent-soft)]" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-[var(--accent-soft)] rounded w-3/4" />
                <div className="h-3 bg-[var(--accent-soft)] rounded w-full" />
                <div className="h-3 bg-[var(--accent-soft)] rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">Ma'lumotlarni yuklashda xatolik</p>
          <Button variant="ghost" className="mt-3" onClick={() => void query.refetch()}>Qayta urinish</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #f09433, #bc1888)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="m3 9 4-4 4 4 4-5 4 5"/>
            </svg>
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--foreground)] mb-1">Kontekst topilmadi</h3>
          <p className="text-[13px] text-[var(--caption)] mb-4 max-w-xs">
            {contexts.length === 0 ? "Birinchi media contextni qo'shing" : 'Filter shartlariga mos kontekst yo\'q'}
          </p>
          {contexts.length === 0 && (
            <Button onClick={() => setIsCreating(true)} style={{ background: 'linear-gradient(135deg, #f09433 0%, #bc1888 100%)', border: 'none' }} className="text-white">
              Birinchi contextni qo'shish
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stories horizontal row */}
          {showStoryRow && (
            <div>
              <p className="text-[11px] font-semibold text-[var(--caption)] uppercase tracking-widest mb-3">Stories</p>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
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
            </div>
          )}

          {/* Posts / Reels / Ads grid */}
          {nonStories.length > 0 && (
            <div>
              {showStoryRow && nonStories.length > 0 && (
                <p className="text-[11px] font-semibold text-[var(--caption)] uppercase tracking-widest mb-3">Posts & Reels & Ads</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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

      {/* Modals */}
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
