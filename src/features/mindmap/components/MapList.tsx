import { useRef, useState } from 'react'
import { FileArrowUpIcon, MagnifyingGlassIcon, PlusIcon, SidebarSimpleIcon, TreeStructureIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import type { MindMapSummary } from '../lib/types'

type Props = {
  maps: MindMapSummary[] | null
  activeId: string | null
  onOpen: (id: string) => void
  onCreate: () => void
  onImport: (file: File) => void
  onCollapse: () => void
}

function stamp(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Left panel: the user's mind maps. */
export function MapList({ maps, activeId, onOpen, onCreate, onImport, onCollapse }: Props) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const needle = search.trim().toLowerCase()
  const shown = (maps ?? []).filter((item) => !needle || item.title.toLowerCase().includes(needle))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
        <p className="text-[14px] font-bold text-[var(--foreground)]">{t('mindmap.list.title', 'Mind map')}</p>
        <button type="button" onClick={onCollapse} title={t('mindmap.list.hide', 'Hide list')} aria-label={t('mindmap.list.hide', 'Hide list')} className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
          <SidebarSimpleIcon size={16} />
        </button>
      </div>
      <div className="space-y-2 px-3.5 pt-3">
        <label className="relative flex h-9 items-center">
          <MagnifyingGlassIcon size={15} className="pointer-events-none absolute left-2.5 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('mindmap.list.search', 'Search mind maps…')}
            aria-label={t('mindmap.list.search', 'Search mind maps…')}
            className="h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] pr-3 pl-8 text-[12.5px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={onCreate}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[11px] bg-[var(--primary)] text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_var(--primary)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98]"
        >
          <PlusIcon size={15} weight="bold" />
          {t('mindmap.list.new', 'New mind map')}
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-2">
        {maps === null ? (
          Array.from({ length: 3 }, (_, index) => <span key={index} className="skeleton block h-[52px] rounded-[12px]" />)
        ) : shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12.5px] text-[var(--muted)]">
            {needle ? t('mindmap.list.not_found', 'Nothing found') : t('mindmap.list.empty', 'No mind maps yet')}
          </p>
        ) : (
          shown.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-[12px] border px-2.5 py-2 text-left transition-colors',
                item.id === activeId ? 'border-[var(--primary)] bg-[var(--blue-dim)]' : 'border-transparent hover:bg-[var(--input-surface)]',
              )}
            >
              <TreeStructureIcon size={16} weight="duotone" className={cn('mt-0.5 shrink-0', item.id === activeId ? 'text-[var(--primary)]' : 'text-[var(--muted-strong)]')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-[var(--foreground)]" data-i18n-skip="true">{item.title || '…'}</span>
                <span className="block text-[11.5px] text-[var(--muted)] tabular-nums">
                  {t('mindmap.node_count', '{{count}} nodes', { count: item.nodeCount })} · {stamp(item.updatedAt)}
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-[var(--border-subtle)] px-2.5 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImport(file)
            event.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="flex h-8 w-full items-center gap-2 rounded-[9px] px-2 text-[12px] font-medium text-[var(--muted-strong)] hover:bg-[var(--input-surface)] hover:text-[var(--foreground)]">
          <FileArrowUpIcon size={15} />
          {t('mindmap.list.import', 'Import from JSON')}
        </button>
      </div>
    </div>
  )
}
