import { useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { CaretRightIcon, HardDrivesIcon, LockSimpleIcon } from '@phosphor-icons/react'
import { useLocale } from '../../../app/hooks/useLocale'
import type { FmFolder } from '../../../shared/api/services/fileManager.service'
import { Skeleton } from '../../../shared/ui/skeleton'
import { ROOT_KEY, dropKey, type DropHandlers, type DropTarget } from '../lib/explorer'
import type { FolderTree as Tree } from '../lib/useFolderTree'
import type { MenuAnchor } from './ContextMenu'
import { ItemGlyph } from './ItemGlyph'

type Ctx = {
  tree: Tree
  /** Open folder (null = top level, undefined = none, e.g. while searching everywhere). */
  currentId: string | null | undefined
  dropHover: string | null
  getDropProps: (target: DropTarget) => DropHandlers | null
  onGo: (id: string | null) => void
  onMenu: (folder: FmFolder | null, ancestors: string[], anchor: MenuAnchor, fromKeyboard: boolean) => void
}

const INDENT = 14

/** Navigation pane: "All files" and every folder below it, unfolded on demand (like Explorer's tree). */
export function FolderTree({
  tree,
  currentId,
  rootLabel,
  dropHover,
  getDropProps,
  onGo,
  onMenu,
}: {
  tree: Tree
  currentId: string | null | undefined
  rootLabel: string
  dropHover: string | null
  getDropProps: Ctx['getDropProps']
  onGo: (id: string | null) => void
  onMenu: Ctx['onMenu']
}) {
  const { t } = useLocale()
  const treeRef = useRef<HTMLDivElement | null>(null)
  const ctx: Ctx = { tree, currentId, dropHover, getDropProps, onGo, onMenu }
  const rootOpen = tree.expanded.has(ROOT_KEY)

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = Array.from(treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [])
    const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>('[role="treeitem"]') : null
    const index = active ? items.indexOf(active) : -1
    if (index < 0 || event.altKey || event.ctrlKey || event.metaKey) return
    const id = active?.dataset.treeId ?? ROOT_KEY
    const folderId = id === ROOT_KEY ? null : id
    const expanded = active?.getAttribute('aria-expanded')
    let handled = true
    switch (event.key) {
      case 'ArrowDown':
        items[Math.min(items.length - 1, index + 1)]?.focus()
        break
      case 'ArrowUp':
        items[Math.max(0, index - 1)]?.focus()
        break
      case 'Home':
        items[0]?.focus()
        break
      case 'End':
        items[items.length - 1]?.focus()
        break
      case 'ArrowRight':
        if (expanded === 'false') tree.toggle(id, true)
        else if (expanded === 'true') items[index + 1]?.focus()
        break
      case 'ArrowLeft':
        if (expanded === 'true') tree.toggle(id, false)
        else active?.parentElement?.closest<HTMLElement>('[role="treeitem"]')?.focus()
        break
      case 'Enter':
      case ' ':
        onGo(folderId)
        break
      case 'ContextMenu':
      case 'F10':
        if (event.key === 'F10' && !event.shiftKey) {
          handled = false
          break
        }
        if (active) {
          const row = active.querySelector<HTMLElement>('.fx-tree__row') ?? active
          const rect = row.getBoundingClientRect()
          const folder = findFolder(tree, folderId)
          onMenu(folder, ancestorsOf(active), { x: rect.left + 24, y: rect.bottom }, true)
        }
        break
      default:
        handled = false
    }
    if (handled) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <nav className="fx-tree" aria-label={t('files.tree.label', 'Navigation pane')}>
      <div ref={treeRef} role="tree" aria-label={t('files.tree.label', 'Navigation pane')} className="fx-tree__scroll" onKeyDown={onKeyDown}>
        <div role="treeitem" aria-level={1} aria-expanded={rootOpen} aria-selected={currentId === null} tabIndex={currentId === null ? 0 : -1} data-tree-id={ROOT_KEY} className="fx-tree__item">
          <TreeRow
            ctx={ctx}
            id={null}
            name={rootLabel}
            depth={0}
            ancestors={[]}
            open={rootOpen}
            hasChildren
            icon={<HardDrivesIcon size={17} weight={currentId === null ? 'fill' : 'duotone'} className="fx-tree__root-icon" />}
          />
          {rootOpen ? <TreeBranch ctx={ctx} parentKey={ROOT_KEY} depth={1} ancestors={[]} /> : null}
        </div>
      </div>
      <p className="fx-tree__note">
        <LockSimpleIcon size={13} weight="bold" className="mt-px shrink-0" />
        <span>{t('files.side.private', 'Private storage — files open only with your sign-in.')}</span>
      </p>
    </nav>
  )
}

function findFolder(tree: Tree, id: string | null): FmFolder | null {
  if (id === null) return null
  // Any loaded list that holds it (cheap: the tree is small).
  for (const key of tree.expanded) {
    const found = tree.childrenOf(key)?.find((folder) => folder.id === id)
    if (found) return found
  }
  return null
}

function ancestorsOf(element: HTMLElement) {
  const ids: string[] = []
  let parent = element.parentElement?.closest<HTMLElement>('[role="treeitem"]')
  while (parent) {
    const id = parent.dataset.treeId
    if (id && id !== ROOT_KEY) ids.unshift(id)
    parent = parent.parentElement?.closest<HTMLElement>('[role="treeitem"]') ?? null
  }
  return ids
}

function TreeBranch({ ctx, parentKey, depth, ancestors }: { ctx: Ctx; parentKey: string; depth: number; ancestors: string[] }) {
  const { t } = useLocale()
  const folders = ctx.tree.childrenOf(parentKey)
  if (!folders) {
    if (!ctx.tree.isLoading(parentKey)) return null
    return (
      <div role="group" className="fx-tree__group" aria-busy="true">
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-2 py-1.5 pr-2" style={{ paddingLeft: 10 + depth * INDENT + 18 }}>
            <Skeleton className="h-4 w-4" rounded="sm" />
            <Skeleton className="h-3 flex-1" rounded="full" />
          </div>
        ))}
      </div>
    )
  }
  if (!folders.length) {
    return depth === 1 ? <p className="fx-tree__empty" style={{ paddingLeft: 10 + depth * INDENT + 18 }}>{t('files.side.none', 'No folders yet')}</p> : null
  }
  return (
    <div role="group" className="fx-tree__group">
      {folders.map((folder) => <TreeNode key={folder.id} ctx={ctx} folder={folder} depth={depth} ancestors={ancestors} />)}
    </div>
  )
}

function TreeNode({ ctx, folder, depth, ancestors }: { ctx: Ctx; folder: FmFolder; depth: number; ancestors: string[] }) {
  const open = ctx.tree.expanded.has(folder.id)
  const children = ctx.tree.childrenOf(folder.id)
  const hasChildren = children ? children.length > 0 : folder.folderCount !== 0
  const current = ctx.currentId === folder.id
  return (
    <div
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? open : undefined}
      aria-selected={current}
      tabIndex={current ? 0 : -1}
      data-tree-id={folder.id}
      className="fx-tree__item"
    >
      <TreeRow
        ctx={ctx}
        id={folder.id}
        name={folder.name}
        depth={depth}
        ancestors={ancestors}
        open={open}
        hasChildren={hasChildren}
        folder={folder}
        icon={<ItemGlyph kind="folder" size={20} open={current} filled={current || (folder.fileCount ?? 0) > 0} />}
      />
      {open && hasChildren ? <TreeBranch ctx={ctx} parentKey={folder.id} depth={depth + 1} ancestors={[...ancestors, folder.id]} /> : null}
    </div>
  )
}

function TreeRow({
  ctx,
  id,
  name,
  depth,
  ancestors,
  open,
  hasChildren,
  folder = null,
  icon,
}: {
  ctx: Ctx
  id: string | null
  name: string
  depth: number
  ancestors: string[]
  open: boolean
  hasChildren: boolean
  folder?: FmFolder | null
  icon: ReactNode
}) {
  const { t } = useLocale()
  const key = id ?? ROOT_KEY
  const current = ctx.currentId === id
  const drop = ctx.getDropProps({ id, name, ancestors })
  const hoverTimer = useRef<number | undefined>(undefined)

  // Hovering a closed folder while dragging opens it after a moment (like Explorer).
  function armExpand() {
    if (open || !hasChildren || hoverTimer.current) return
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = undefined
      ctx.tree.toggle(key, true)
    }, 700)
  }
  function disarm() {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = undefined
  }

  return (
    <div
      className="fx-tree__row"
      data-current={current || undefined}
      data-drop={ctx.dropHover === dropKey(id) || undefined}
      style={{ paddingLeft: 6 + depth * INDENT }}
      title={name}
      onClick={() => ctx.onGo(id)}
      onDoubleClick={() => hasChildren && ctx.tree.toggle(key)}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        ctx.onMenu(folder, ancestors, { x: event.clientX, y: event.clientY }, false)
      }}
      onDragOver={drop ? (event) => { drop.onDragOver(event); armExpand() } : undefined}
      onDragLeave={drop ? (event) => { drop.onDragLeave(event); if (!event.currentTarget.contains(event.relatedTarget as Node | null)) disarm() } : undefined}
      onDrop={drop ? (event) => { disarm(); drop.onDrop(event) } : undefined}
    >
      {hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          className="fx-tree__twisty"
          data-open={open || undefined}
          aria-label={open ? t('files.tree.collapse', 'Collapse') : t('files.tree.expand', 'Expand')}
          onClick={(event) => {
            event.stopPropagation()
            ctx.tree.toggle(key)
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <CaretRightIcon size={11} weight="bold" />
        </button>
      ) : (
        <span className="fx-tree__twisty" aria-hidden="true" />
      )}
      <span className="fx-tree__icon">{icon}</span>
      <span className="fx-tree__name">{name}</span>
      {folder?.system ? <LockSimpleIcon size={12} weight="bold" className="shrink-0 text-[var(--muted)]" aria-label={t('files.system_folder', 'System folder')} /> : null}
    </div>
  )
}
