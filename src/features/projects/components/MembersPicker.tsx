import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import type { UserSummary } from '../../../shared/api/services/projects.service'
import { Avatar } from './Avatar'

type MembersPickerProps = {
  members: UserSummary[]
  /** Heading of the list, e.g. "Members". */
  label: string
  /** Shown under a name when the person has no job title. */
  fallbackRole: string
  onSelect: (memberId: number) => void
}

/** A compact "faces + count" button that opens the project's people; picking one opens their tasks. */
export function MembersPicker({ members, label, fallbackRole, onSelect }: MembersPickerProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null)
  const visible = members.slice(0, 4)

  useEffect(() => {
    if (!position) return
    const close = () => setPosition(null)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [position])

  function toggle() {
    if (position) {
      setPosition(null)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) })
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        title={label}
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[10px] border border-[var(--border-hover)] bg-[var(--surface)] pr-2 pl-1.5 transition-colors hover:bg-[var(--input-surface)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none"
      >
        <span className="flex items-center">
          {visible.map((member, index) => (
            <span key={member.id} className="relative rounded-full ring-2 ring-[var(--surface)]" style={{ marginLeft: index ? -4 : 0, zIndex: visible.length - index }}>
              <Avatar name={member.name} surname={member.surname} imageUrl={member.profile_image} size="sm" className="h-6 w-6 text-[9.5px]" />
            </span>
          ))}
        </span>
        <span className="text-[12.5px] font-semibold text-[var(--foreground)] tabular-nums">{members.length}</span>
        <ChevronDown size={14} strokeWidth={2} className="text-[var(--muted)]" />
      </button>

      {position
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[119]" onClick={() => setPosition(null)} aria-hidden="true" />
              <div
                role="menu"
                className="fixed z-[120] max-h-[min(380px,70vh)] w-[272px] overflow-y-auto rounded-[14px] bg-[var(--surface)] p-1.5 text-[var(--foreground)] shadow-[var(--elev-lg)] ring-1 ring-[var(--border)]"
                style={position}
              >
                <p className="px-2.5 pt-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[var(--muted)] uppercase">
                  {label} · <span className="tabular-nums">{members.length}</span>
                </p>
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPosition(null)
                      onSelect(member.id)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--input-surface)]"
                  >
                    <Avatar name={member.name} surname={member.surname} imageUrl={member.profile_image} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{member.name} {member.surname}</span>
                      <span className="block truncate text-[11.5px] text-[var(--muted)]">{member.job_title || fallbackRole}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  )
}
