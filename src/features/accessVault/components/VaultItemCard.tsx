import { useState, type CSSProperties } from 'react'
import { Check, Copy, ExternalLink, Eye, EyeOff, Loader2, Lock, MoreHorizontal, Pencil, ScrollText, Trash2, UserPlus } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { VaultItem } from '../../../shared/api/services/accessVault.service'
import { cn } from '../../../shared/lib/cn'
import { MemberAvatar } from '../../../shared/ui/member-avatar'
import { categoryOf, hostOf, hrefOf } from '../lib/categories'

function CopyChip({ value, label, onCopied }: { value: string; label: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true)
          onCopied?.()
          window.setTimeout(() => setDone(false), 1400)
        })
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--primary)]"
    >
      {done ? <Check size={14} className="text-[var(--success-text)]" /> : <Copy size={14} />}
    </button>
  )
}

/** One stored access: login, the hidden password (open / copy), and who may open it. */
export function VaultItemCard({ item, secret, revealing, canManage, onReveal, onHide, onCopySecret, onEdit, onGrants, onAudit, onDelete }: {
  item: VaultItem
  /** The opened secret, while it is shown. */
  secret: string | null
  revealing: boolean
  canManage: boolean
  onReveal: () => void
  onHide: () => void
  onCopySecret: () => void
  onEdit: () => void
  onGrants: () => void
  onAudit: () => void
  onDelete: () => void
}) {
  const { t } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const category = categoryOf(item.category)
  const host = hostOf(item.url)
  const shownPeople = item.grantees.slice(0, 4)

  return (
    <article className={cn('group/vault relative flex flex-col gap-3 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--elev-sm)] transition-[border-color,box-shadow] hover:border-[var(--border-hover)]', !item.isActive && 'opacity-60')}>
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ color: category.color, background: `color-mix(in srgb, ${category.color} 13%, transparent)` } as CSSProperties}>
          <category.icon size={19} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14.5px] leading-5 font-semibold tracking-[-0.01em] text-[var(--foreground)]">{item.title}</h3>
          {host && item.url ? (
            <a href={hrefOf(item.url)} target="_blank" rel="noreferrer noopener" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] text-[var(--muted)] hover:text-[var(--primary)]">
              <span className="truncate">{host}</span><ExternalLink size={11} className="shrink-0" />
            </a>
          ) : (
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">{t(category.labelKey, category.fallback)}</p>
          )}
        </div>
        {canManage ? (
          <div className="relative -mt-1 -mr-1.5">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={t('vault.card.actions', 'Actions')} aria-expanded={menuOpen} className="grid h-8 w-8 place-items-center rounded-[9px] text-[var(--muted)] hover:bg-[var(--muted-surface)] hover:text-[var(--foreground)]">
              <MoreHorizontal size={17} />
            </button>
            {menuOpen ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute top-9 right-0 z-20 w-48 rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--elev-xl)]">
                  {[
                    { icon: Pencil, label: t('common.edit', 'Edit'), run: onEdit },
                    { icon: UserPlus, label: t('vault.card.manage_access', 'Manage access'), run: onGrants },
                    { icon: ScrollText, label: t('vault.card.history', 'Access history'), run: onAudit },
                  ].map((entry) => (
                    <button key={entry.label} type="button" role="menuitem" onClick={() => { setMenuOpen(false); entry.run() }} className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[var(--foreground)] hover:bg-[var(--muted-surface)]">
                      <entry.icon size={14} className="text-[var(--muted-strong)]" />{entry.label}
                    </button>
                  ))}
                  <div className="my-1 h-px bg-[var(--border)]" />
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onDelete() }} className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[var(--danger-text)] hover:bg-[var(--danger-dim)]">
                    <Trash2 size={14} />{t('common.delete', 'Delete')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="space-y-1.5">
        {item.login ? (
          <div className="flex items-center gap-2 rounded-[11px] bg-[var(--muted-surface)] py-1 pr-1 pl-3">
            <span className="w-14 shrink-0 text-[11.5px] text-[var(--muted)]">{t('vault.card.login', 'Login')}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[var(--foreground)]">{item.login}</span>
            <CopyChip value={item.login} label={t('vault.card.copy_login', 'Copy login')} />
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-[11px] bg-[var(--muted-surface)] py-1 pr-1 pl-3">
          <span className="w-14 shrink-0 text-[11.5px] text-[var(--muted)]">{t('vault.card.password', 'Password')}</span>
          <span className={cn('min-w-0 flex-1 truncate font-mono text-[12.5px]', secret ? 'text-[var(--foreground)]' : 'tracking-[0.18em] text-[var(--muted-strong)]')}>
            {secret ?? '••••••••••'}
          </span>
          {item.canReveal ? (
            <>
              <button
                type="button"
                onClick={secret ? onHide : onReveal}
                disabled={revealing}
                title={secret ? t('vault.card.hide', 'Hide') : t('vault.card.show', 'Show')}
                aria-label={secret ? t('vault.card.hide', 'Hide') : t('vault.card.show', 'Show')}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--primary)] disabled:cursor-wait"
              >
                {revealing ? <Loader2 size={14} className="animate-spin" /> : secret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              {secret ? <CopyChip value={secret} label={t('vault.card.copy_password', 'Copy password')} onCopied={onCopySecret} /> : null}
            </>
          ) : (
            <span title={t('vault.card.no_reveal', 'You can see this entry but not its password')} className="grid h-7 w-7 place-items-center text-[var(--caption)]"><Lock size={14} /></span>
          )}
        </div>
      </div>

      {item.notes ? <p className="line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--muted-strong)]">{item.notes}</p> : null}

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <button type="button" onClick={canManage ? onGrants : undefined} disabled={!canManage} className="flex min-w-0 items-center gap-2 rounded-[9px] text-left disabled:cursor-default">
          {item.grantees.length ? (
            <span className="flex -space-x-2">
              {shownPeople.map((person) => <MemberAvatar key={person.id} name={person.name} size="xs" className="ring-2 ring-[var(--surface)]" title={person.name} />)}
            </span>
          ) : null}
          <span className="truncate text-[12px] text-[var(--muted)]">
            {item.grantees.length
              ? t('vault.card.people', '{{count}} people have access', { count: item.grantees.length })
              : item.granteesKnown
                ? t('vault.card.only_admins', 'Only managers')
                : t('vault.card.grants_unknown', 'Who has access')}
          </span>
        </button>
        {!item.isActive ? <span className="rounded-[6px] bg-[var(--muted-surface)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--muted-strong)] uppercase">{t('vault.card.inactive', 'Archived')}</span> : null}
      </footer>
    </article>
  )
}
