import { Fragment, type ReactNode } from 'react'
import { CaretDownIcon } from '@phosphor-icons/react'
import { cn } from '../../../shared/lib/cn'

export type Command = {
  id: string
  label: string
  icon: ReactNode
  onRun: (element: HTMLElement) => void
  disabled?: boolean
  /** Tooltip (label + shortcut, or why it is disabled). */
  title?: string
  /** Opens a drop-down menu (draws the ▾). */
  dropdown?: boolean
  /** Toggle buttons (details pane, active filter). */
  pressed?: boolean
  tone?: 'primary' | 'danger'
  /** Text next to the icon: always, only when the explorer is wide, or never (icon + tooltip). */
  text?: 'always' | 'wide' | 'never'
  /** Hidden on narrow explorers — the "⋯" menu has it then. */
  collapse?: boolean
  badge?: number
}

/** Explorer command bar (New ▾ · edit commands · Sort ▾ View ▾ Filter ▾ · ⋯ · Details). */
export function CommandBar({ groups, trailing, openMenuId, label }: { groups: Command[][]; trailing: Command[]; openMenuId: string | null; label: string }) {
  return (
    <div className="fx-cmdbar" role="toolbar" aria-label={label}>
      {groups.filter((group) => group.length).map((group, index) => {
        const collapse = group.every((command) => command.collapse)
        return (
          <Fragment key={group[0].id}>
            {index > 0 ? <span className="fx-cmd-sep" data-collapse={collapse || undefined} aria-hidden="true" /> : null}
            {group.map((command) => <CommandButton key={command.id} command={command} open={openMenuId === command.id} />)}
          </Fragment>
        )
      })}
      <span className="flex-1" />
      {trailing.map((command) => <CommandButton key={command.id} command={command} open={openMenuId === command.id} />)}
    </div>
  )
}

function CommandButton({ command, open }: { command: Command; open: boolean }) {
  const text = command.text ?? 'wide'
  return (
    <button
      type="button"
      className={cn('fx-cmd', command.id === 'more' && 'fx-cmd--more')}
      data-text={text}
      data-tone={command.tone}
      data-collapse={command.collapse || undefined}
      data-open={open || undefined}
      aria-pressed={command.pressed}
      aria-haspopup={command.dropdown ? 'menu' : undefined}
      aria-expanded={command.dropdown ? open : undefined}
      aria-label={text === 'always' ? undefined : command.label}
      title={command.title ?? command.label}
      disabled={command.disabled}
      onClick={(event) => command.onRun(event.currentTarget)}
    >
      <span className="fx-cmd__icon">
        {command.icon}
        {command.badge ? <span className="fx-cmd__badge">{command.badge}</span> : null}
      </span>
      <span className="fx-cmd__text">{command.label}</span>
      {command.dropdown ? <CaretDownIcon size={10} weight="bold" className="fx-cmd__caret" /> : null}
    </button>
  )
}
