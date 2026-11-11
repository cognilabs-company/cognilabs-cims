import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { authService } from '../../shared/api/services/auth.service'
import { env } from '../../shared/config/env'
import { type AppLocale, localeLabels } from '../../shared/i18n/translations'
import { cn } from '../../shared/lib/cn'
import { getAccessibleNavigation, resolveNavRoute } from '../../shared/lib/permissions'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { resolveMediaUrl } from '../../shared/lib/media-url'
import { useToast } from '../../shared/toast/useToast'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { Dialog } from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { BrandMark, BrandWordmark } from '../../shared/ui/brand-logo'
import { NavGlyph } from './NavGlyph'
import { getNavigationGlyphName, type GlyphName } from './navGlyphMap'
import { OPEN_PROFILE_EVENT } from './profileEvents'


function getInitials(name?: string, surname?: string) {
  return `${name?.charAt(0) ?? ''}${surname?.charAt(0) ?? ''}`.toUpperCase() || 'CI'
}

function humanizePermissionKey(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

type MemberProfileFormState = {
  name: string
  surname: string
  current_password: string
  new_password: string
}

const sidebarItemBase =
  'group relative flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] [@media(max-height:900px)]:py-[5.5px] [@media(max-height:760px)]:py-[4px] text-[13.5px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35'
const sidebarItemInactive =
  'font-medium text-[var(--sb-text)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-strong)] [&_svg]:text-[var(--sb-icon)] hover:[&_svg]:text-[var(--sb-strong)]'
const sidebarItemActive =
  'bg-[var(--primary)] font-semibold text-white shadow-[0_8px_18px_-12px_rgba(43,89,255,0.9)] [&_svg]:text-white'
const sidebarIcon = 'h-[17px] w-[17px] shrink-0 transition-colors'

type OutboundSidebarItem = {
  to: string
  label: string
  glyph: GlyphName
  isActive: (pathname: string) => boolean
}

const sidebarSectionLabel =
  'px-2.5 pt-0.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--sb-label)]'
/** Collapsed rail: icon-only items */
const railItem = 'justify-center px-0 [&>span.nav-label]:sr-only'

type NavGroupKey = 'main' | 'sales' | 'work' | 'team' | 'ai' | 'system'
const groupOrder: NavGroupKey[] = ['main', 'sales', 'work', 'team', 'ai', 'system']
const groupFallback: Record<NavGroupKey, string> = {
  main: 'Overview', sales: 'Sales', work: 'Work', team: 'Team', ai: 'Cognilabs AI', system: 'System',
}

/** Backend navigation groups ("SOTUV", "Sales"…) → our translated group labels. */
const rbacGroupKeys: Record<string, NavGroupKey> = {
  asosiy: 'main', main: 'main', overview: 'main', 'основное': 'main',
  sotuv: 'sales', sales: 'sales', 'продажи': 'sales',
  ish: 'work', work: 'work', 'работа': 'work',
  jamoa: 'team', team: 'team', 'команда': 'team',
  'cognilabs ai': 'ai', ai: 'ai',
  tizim: 'system', system: 'system', 'система': 'system',
}

/** Backend icon names → our glyphs, for routes we don't know yet. */
const rbacIconGlyphs: Record<string, GlyphName> = {
  chart: 'crm', crm: 'crm', dashboard: 'ceo', users: 'users', user: 'users', customers: 'customers', phone: 'phone', calls: 'phone',
  projects: 'projects', folder: 'projects', calendar: 'attendance', clock: 'attendance', wallet: 'salary', money: 'salary',
  kpi: 'kpi', chat: 'cognilabsai-chat', kanban: 'ai-kanban', image: 'media', media: 'media', plug: 'cognilabsai-integrations',
  instagram: 'instagram', globe: 'website', settings: 'management', api: 'management', updates: 'team-updates',
}

type SidebarItem = { to: string; label: string; icon?: string | null }
type SidebarGroup = { key: string; label: string; items: SidebarItem[] }

/** Pages taken out of the menu. */
const hiddenRoutes = new Set(['/ceo/website-stats', '/cognilabsai/media-contexts', '/ceo/team-updates'])
/** Pages shown as one menu item (tabs on the merged page); the item sits where the last of them was. */
const mergedRoutes: Array<{ to: string; from: string[]; label: [string, string] }> = [
  { to: '/settings', from: ['/cognilabsai/integrations', '/ceo/management'], label: ['nav./settings.label', 'Settings'] },
  { to: '/salary', from: ['/faults', '/developer-kpi'], label: ['nav./salary.label', 'Salary & KPI'] },
]

function consolidate(groups: SidebarGroup[], t: (key: string, fallback: string) => string): SidebarGroup[] {
  // The merged page's own route counts too (the backend may already send /salary or /settings).
  const mergeOf = (to: string) => mergedRoutes.find((entry) => entry.to === to || entry.from.includes(to))
  const lastIndex = new Map<string, string>()
  groups.forEach((group, groupIndex) => group.items.forEach((item, itemIndex) => {
    const merged = mergeOf(item.to)
    if (merged) lastIndex.set(merged.to, `${groupIndex}:${itemIndex}`)
  }))
  const seen = new Set<string>()
  return groups
    .map((group, groupIndex) => ({
      ...group,
      items: group.items.flatMap((item, itemIndex) => {
        if (hiddenRoutes.has(item.to)) return []
        const merged = mergeOf(item.to)
        const next = merged
          ? (lastIndex.get(merged.to) === `${groupIndex}:${itemIndex}` ? { to: merged.to, label: t(merged.label[0], merged.label[1]) } : null)
          : item
        // Never the same page twice in the menu.
        if (!next || seen.has(next.to)) return []
        seen.add(next.to)
        return [next]
      }),
    }))
    .filter((group) => group.items.length > 0)
}

/**
 * Mind map is a frontend-only page (not in the backend navigation): show it right after Projects,
 * or at the end of the menu when Projects is not there.
 */
function withMindMap(groups: SidebarGroup[], label: string): SidebarGroup[] {
  if (groups.some((group) => group.items.some((item) => item.to === '/mindmap'))) return groups
  const entry: SidebarItem = { to: '/mindmap', label, icon: 'mindmap' }
  const index = groups.findIndex((group) => group.items.some((item) => item.to.startsWith('/projects')))
  if (index === -1) {
    if (!groups.length) return groups
    const last = groups[groups.length - 1]
    return [...groups.slice(0, -1), { ...last, items: [...last.items, entry] }]
  }
  return groups.map((group, position) => {
    if (position !== index) return group
    const at = group.items.findIndex((item) => item.to.startsWith('/projects'))
    return { ...group, items: [...group.items.slice(0, at + 1), entry, ...group.items.slice(at + 1)] }
  })
}

function navGroupOf(path: string): NavGroupKey {
  if (path === '/member/dashboard' || path === '/ceo/dashboard') return 'main'
  if (path.startsWith('/crm') || path.startsWith('/outbound-crm') || path.startsWith('/telephony')) return 'sales'
  if (path.startsWith('/projects') || path.startsWith('/mindmap')) return 'work'
  if (path.startsWith('/cognilabsai') || path.startsWith('/ceo/ai')) return 'ai'
  if (['/ceo/website-stats', '/ceo/management', '/audit', '/ceo/workday-overrides'].some((prefix) => path.startsWith(prefix))) return 'system'
  return 'team'
}

const profileFieldCard = 'rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4'

export function AppSidebar() {
  const location = useLocation()
  const { closeSidebar, isSidebarCollapsed, isSidebarOpen, toggleSidebar, toggleSidebarCollapsed } = useAppShell()
  const { locale, setLocale, t } = useLocale()
  const { showToast } = useToast()
  const { user, refreshUser, access, can } = useAuth()
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches)
    setIsMobileViewport(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const rail = isSidebarCollapsed && !isMobileViewport
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null)
  const showTip = (label: string) => (event: ReactMouseEvent<HTMLElement>) => {
    if (!rail) return
    const rect = event.currentTarget.getBoundingClientRect()
    setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 10 })
  }
  const hideTip = () => setTip(null)
  const tipProps = (label: string) => ({ title: rail ? undefined : label, onMouseEnter: showTip(label), onMouseLeave: hideTip, onFocus: showTip(label) as never, onBlur: hideTip })

  const isOutboundCrmRoute = location.pathname === '/outbound-crm' || location.pathname.startsWith('/outbound-crm/')
  const outboundNavigation: OutboundSidebarItem[] = [
    {
      to: '/outbound-crm',
      label: t('outbound_crm.sidebar.dashboard', 'Dashboard'),
      glyph: 'crm',
      isActive: (pathname) => pathname === '/outbound-crm',
    },
    {
      to: '/outbound-crm/customers',
      label: t('outbound_crm.sidebar.leads', 'Leads'),
      glyph: 'customers',
      isActive: (pathname) => pathname.startsWith('/outbound-crm/customers'),
    },
    {
      to: '/outbound-crm/statuses',
      label: t('outbound_crm.actions.statuses', 'Statuses'),
      glyph: 'statuses',
      isActive: (pathname) => pathname.startsWith('/outbound-crm/statuses'),
    },
    {
      to: '/outbound-crm/archived',
      label: t('outbound_crm.sidebar.archive', 'Archive'),
      glyph: 'archive',
      isActive: (pathname) => pathname.startsWith('/outbound-crm/archived'),
    },
  ]
  // RBAC: the sidebar is exactly /rbac/me → navigation (groups and order from the backend).
  // Without RBAC the old per-role list is used.
  const sidebarGroups = useMemo<SidebarGroup[]>(() => {
    if (access) {
      const groups = consolidate(access.navigation.map((group, index) => {
        const key = rbacGroupKeys[group.group.trim().toLowerCase()]
        return {
          key: `${group.group}-${index}`,
          label: key ? t(`shell.group.${key}`, groupFallback[key]) : group.group,
          items: group.items.map((item) => ({ to: resolveNavRoute(item), label: item.display_name, icon: item.icon })),
        }
      }), t)
      return withMindMap(groups, t('nav./mindmap.label', 'Mind map'))
    }
    const legacy = getAccessibleNavigation(user, { sidebarOnly: true })
    return consolidate(groupOrder
      .map((group) => ({ key: group, label: t(`shell.group.${group}`, groupFallback[group]), items: legacy.filter((item) => navGroupOf(item.to) === group) }))
      .filter((entry) => entry.items.length > 0), t)
  }, [access, t, user])
  const sidebarNavigation = useMemo(() => sidebarGroups.flatMap((group) => group.items), [sidebarGroups])
  const isProjectsRoute =
    location.pathname === '/projects' ||
    location.pathname.startsWith('/projects/') ||
    location.pathname.startsWith('/boards/')

  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)
  const [isEditingMember, setIsEditingMember] = useState(false)
  const [memberForm, setMemberForm] = useState<MemberProfileFormState>({
    name: '',
    surname: '',
    current_password: '',
    new_password: '',
  })
  const [isSavingMember, setIsSavingMember] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const profileImageInputRef = useRef<HTMLInputElement>(null)
  const openMemberDialogRef = useRef<() => void>(() => {})

  const activePermissions = useMemo(
    () =>
      Object.entries(user?.permissions ?? {})
        .filter(([, isEnabled]) => isEnabled)
        .map(([key]) => humanizePermissionKey(key)),
    [user?.permissions],
  )

  const getNavigationLabel = (path: string, fallback: string) => t(`nav.${path}.label`, fallback)


  const resolvedUserProfileImage = resolveMediaUrl(user?.profile_image) ?? user?.profile_image ?? null
  const profilePreviewUrl = useMemo(() => {
    if (!profileImageFile) return resolvedUserProfileImage
    return URL.createObjectURL(profileImageFile)
  }, [profileImageFile, resolvedUserProfileImage])

  useEffect(() => { closeSidebar() }, [closeSidebar, location.pathname])


  useEffect(() => {
    if (!profileImageFile || !profilePreviewUrl?.startsWith('blob:')) return
    return () => { URL.revokeObjectURL(profilePreviewUrl) }
  }, [profileImageFile, profilePreviewUrl])

  function openMemberDialog() {
    if (!user) return
    setMemberForm({ name: user.name ?? '', surname: user.surname ?? '', current_password: '', new_password: '' })
    setProfileImageFile(null)
    setIsEditingMember(false)
    setIsMemberDialogOpen(true)
  }


  function closeMemberDialog() {
    setIsMemberDialogOpen(false)
    setIsEditingMember(false)
    setProfileImageFile(null)
  }

  function handleSidebarToggle() {
    if (isMobileViewport) { toggleSidebar(); return }
    toggleSidebarCollapsed()
  }

  function updateMemberForm<K extends keyof MemberProfileFormState>(key: K, value: MemberProfileFormState[K]) {
    setMemberForm((c) => ({ ...c, [key]: value }))
  }

  async function handleSaveMemberProfile() {
    if (!user) return
    const nextName = memberForm.name.trim()
    const nextSurname = memberForm.surname.trim()
    const currentPassword = memberForm.current_password.trim()
    const newPassword = memberForm.new_password.trim()

    if (!nextName || !nextSurname) {
      showToast({ title: t('profile.update_failed'), description: t('profile.fill_required', 'Name and surname are required.'), tone: 'error' })
      return
    }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      showToast({ title: t('profile.update_failed'), description: t('profile.password_pair_required', 'Both password fields must be filled to change the password.'), tone: 'error' })
      return
    }
    const hasNameChange = nextName !== (user.name ?? '') || nextSurname !== (user.surname ?? '')
    const hasPasswordChange = Boolean(currentPassword || newPassword)
    const hasImageChange = profileImageFile instanceof File
    if (!hasNameChange && !hasPasswordChange && !hasImageChange) {
      showToast({ title: t('profile.no_changes_title', 'No profile changes'), description: t('profile.no_changes_description', 'Update a field, password, or photo before saving.'), tone: 'error' })
      return
    }

    setIsSavingMember(true)
    try {
      await authService.updateProfile({ name: nextName, surname: nextSurname, current_password: currentPassword || undefined, new_password: newPassword || undefined, image: profileImageFile })
      await refreshUser()
      setMemberForm({ name: nextName, surname: nextSurname, current_password: '', new_password: '' })
      setProfileImageFile(null)
      setIsEditingMember(false)
      showToast({ title: t('profile.updated'), tone: 'success' })
    } catch (error) {
      showToast({ title: t('profile.update_failed'), description: getApiErrorMessage(error), tone: 'error' })
    } finally {
      setIsSavingMember(false)
    }
  }

  useEffect(() => {
    openMemberDialogRef.current = openMemberDialog
  })

  useEffect(() => {
    const handleOpen = () => openMemberDialogRef.current()
    window.addEventListener(OPEN_PROFILE_EVENT, handleOpen)
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, handleOpen)
  }, [])

  function glyphFor(item: SidebarItem): GlyphName {
    const byRoute = getNavigationGlyphName(item.to)
    return byRoute === 'default' && item.icon ? rbacIconGlyphs[item.icon.toLowerCase()] ?? 'default' : byRoute
  }

  function renderNavItem(item: SidebarItem) {
    const itemLabel = getNavigationLabel(item.to, item.label)

    // Projects: a plain menu item (no project list under it); also active on /boards/… pages.
    if (item.to === '/projects') {
      return (
        <NavLink
          key={item.to}
          to={item.to}
          aria-label={itemLabel}
          {...tipProps(itemLabel)}
          className={({ isActive }) => cn(sidebarItemBase, rail && railItem, isActive || isProjectsRoute ? sidebarItemActive : sidebarItemInactive)}
        >
          <NavGlyph name={glyphFor(item)} className={sidebarIcon} />
          <span className="nav-label flex-1 truncate text-left">{itemLabel}</span>
        </NavLink>
      )
    }

    // A parent route (/crm) is only "active" on itself when a child (/crm/customers) has its own item.
    const hasChildItem = sidebarNavigation.some((other) => other.to !== item.to && other.to.startsWith(`${item.to}/`))

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={hasChildItem}
        aria-label={itemLabel}
        {...tipProps(itemLabel)}
        className={({ isActive }) => cn(sidebarItemBase, rail && railItem, isActive ? sidebarItemActive : sidebarItemInactive)}
      >
        <NavGlyph name={glyphFor(item)} className={sidebarIcon} />
        <span className="nav-label flex-1 truncate text-left">{itemLabel}</span>
      </NavLink>
    )
  }

  const subtitle = isOutboundCrmRoute ? 'Outbound CRM' : (user?.job_title?.trim() || user?.role || t('shell.user'))

  return (
    <>
      <button
        type="button"
        aria-label={t('shell.close_navigation_overlay')}
        onClick={closeSidebar}
        className={cn(
          'shell-scrim fixed inset-0 z-30 bg-[rgba(14,21,37,0.4)] lg:hidden',
          isSidebarOpen ? 'shell-scrim--open pointer-events-auto' : 'shell-scrim--closed pointer-events-none',
        )}
      />

      <aside
        className={cn(
          'app-chrome shell-sidebar fixed inset-y-0 left-0 z-40 w-[min(88vw,var(--sidebar-w))] p-2 lg:sticky lg:inset-auto lg:top-0 lg:h-screen lg:w-[var(--sidebar-w)] lg:self-start lg:overflow-hidden lg:py-[14px] lg:pr-0 lg:pl-[14px]',
          isSidebarOpen ? 'shell-sidebar--open' : 'shell-sidebar--closed',
          rail && 'lg:w-[var(--sidebar-rail-w)]',
        )}
      >
        <div className={cn('flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--sb-line)] bg-[var(--sb-bg)] pt-4 pb-3 shadow-[var(--sb-shadow)] transition-[padding] duration-200', rail ? 'px-2.5' : 'px-3')}>
          {/* Brand */}
          <div className={cn('flex items-center gap-2.5 pb-3', rail ? 'flex-col px-0' : 'px-1.5')}>
            <BrandMark size={38} />
            <div className={cn('min-w-0 flex-1', rail && 'hidden')}>
              <BrandWordmark height={23} className="text-[var(--sb-strong)]" />
              <p className="mt-0.5 truncate text-[11.5px] leading-4 text-[var(--sb-label)]">CIMS · {subtitle}</p>
            </div>
            <button
              type="button"
              onClick={handleSidebarToggle}
              aria-label={t('shell.toggle_navigation')}
              {...tipProps(t('shell.toggle_navigation'))}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[var(--sb-icon)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35"
            >
              {isMobileViewport ? <X size={17} /> : rail ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          </div>

          {/* Navigation */}
          <nav aria-label={t('shell.menu')} onScroll={hideTip} className="sidebar-fade no-scrollbar -mx-1 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1 py-1">
            {isOutboundCrmRoute ? (
              <div className="flex flex-col gap-0.5">
                {rail ? null : <p className={sidebarSectionLabel}>Outbound CRM</p>}
                {outboundNavigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-label={item.label}
                    {...tipProps(item.label)}
                    className={cn(sidebarItemBase, rail && railItem, item.isActive(location.pathname) ? sidebarItemActive : sidebarItemInactive)}
                  >
                    <NavGlyph name={item.glyph} className={sidebarIcon} />
                    <span className="nav-label flex-1 truncate text-left">{item.label}</span>
                  </NavLink>
                ))}

                {can('crm') ? (
                  <div className="mt-3 border-t border-[var(--sb-line)] pt-3">
                    <NavLink to="/crm" aria-label={t('outbound_crm.header.back_to_crm', 'Main CRM')} {...tipProps(t('outbound_crm.header.back_to_crm', 'Main CRM'))} className={cn(sidebarItemBase, rail && railItem, sidebarItemInactive)}>
                      <NavGlyph name="exit" className={sidebarIcon} />
                      <span className="nav-label flex-1 truncate text-left">{t('outbound_crm.header.back_to_crm', 'Main CRM')}</span>
                    </NavLink>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 [@media(max-height:900px)]:gap-1.5">
                {sidebarGroups.map(({ key, label, items }, index) => (
                  <div key={key} className="flex flex-col gap-px">
                    {rail
                      ? (index > 0 ? <span aria-hidden="true" className="mx-auto mb-1.5 h-px w-7 bg-[var(--sb-line)]" /> : null)
                      : label ? <p className={sidebarSectionLabel}>{label}</p> : null}
                    {items.map(renderNavItem)}
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* Signed-in user (+ language on phones, where the header has no room for it) */}
          <div className="mt-2 border-t border-[var(--sb-line)] pt-2.5">
            <div className="mb-2 flex gap-1 rounded-full bg-[var(--sb-hover)] p-1 sm:hidden" role="group" aria-label={t('shell.language')}>
              {(Object.keys(localeLabels) as AppLocale[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLocale(value)}
                  aria-pressed={locale === value}
                  className={cn(
                    'h-8 flex-1 rounded-full text-[12.5px] transition-colors',
                    locale === value ? 'bg-[var(--surface-inverse)] font-semibold text-white' : 'font-medium text-[var(--sb-text)] hover:text-[var(--sb-strong)]',
                  )}
                >
                  {localeLabels[value]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openMemberDialog}
              disabled={!user}
              className={cn('flex w-full items-center gap-2.5 rounded-[12px] py-1.5 text-left transition-colors hover:bg-[var(--sb-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 disabled:cursor-default', rail ? 'justify-center px-0' : 'px-1.5')}
              aria-label={t('profile.member_details')}
              {...tipProps(user ? `${user.name} ${user.surname}` : t('profile.member_details'))}
            >
              {resolvedUserProfileImage ? (
                <img
                  src={resolvedUserProfileImage}
                  alt={user ? `${user.name} ${user.surname}` : t('shell.authenticated_user')}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--primary)] text-[12px] font-bold text-white">
                  {getInitials(user?.name, user?.surname)}
                </span>
              )}
              <span className={cn('min-w-0 flex-1', rail && 'hidden')}>
                <span className="block truncate text-[13.5px] leading-5 font-semibold text-[var(--sb-strong)]">
                  {user ? `${user.name} ${user.surname}` : t('shell.authenticated_user')}
                </span>
                <span className="block truncate text-[11.5px] leading-4 text-[var(--sb-label)]">
                  {user?.email ?? user?.role ?? t('shell.user')}
                </span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      {rail && tip && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-[8px] bg-[var(--surface-inverse)] px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-white shadow-[var(--elev-md)]"
              style={{ top: tip.top, left: tip.left }}
            >
              {tip.label}
            </span>,
            document.body,
          )
        : null}

      <Dialog
        open={isMemberDialogOpen}
        onClose={closeMemberDialog}
        title={user ? `${user.name} ${user.surname}` : t('profile.member_details')}
        description={user?.email ?? t('profile.current_user')}
        size="lg"
        footer={
          isEditingMember ? (
            <>
              <Button variant="secondary" onClick={() => setIsEditingMember(false)} disabled={isSavingMember}>
                {t('shell.cancel')}
              </Button>
              <Button onClick={() => void handleSaveMemberProfile()} disabled={isSavingMember}>
                {isSavingMember ? `${t('shell.save_changes')}...` : t('shell.save_changes')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={closeMemberDialog}>
                {t('shell.close')}
              </Button>
              <Button onClick={() => setIsEditingMember(true)}>
                {t('shell.edit')}
              </Button>
            </>
          )
        }
      >
        <input
          ref={profileImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null
            setProfileImageFile(file)
            event.target.value = ''
          }}
        />

        <div data-ui-surface="true" className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-[18px] bg-[var(--muted-surface)] p-5">
          <div className="flex min-w-0 items-center gap-4">
            {profilePreviewUrl ? (
              <img
                src={profilePreviewUrl}
                alt={user ? `${user.name} ${user.surname}` : t('profile.member_details')}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[var(--blue-soft)] text-xl font-bold text-[var(--primary)]">
                {getInitials(user?.name, user?.surname)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {user ? `${user.name} ${user.surname}` : t('profile.member_details')}
              </p>
              <p className="ui-helper mt-1">
                {profileImageFile
                  ? profileImageFile.name
                  : t('profile.photo_hint', 'Upload a new profile photo if needed.')}
              </p>
            </div>
          </div>
          {isEditingMember && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => profileImageInputRef.current?.click()}
              disabled={isSavingMember}
            >
              {resolvedUserProfileImage || profileImageFile
                ? t('profile.change_photo', 'Change photo')
                : t('profile.upload_photo', 'Upload photo')}
            </Button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div data-ui-surface="true" className={profileFieldCard}>
            <p className="ui-card-label">{t('profile.role')}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{user?.role ?? t('shell.user')}</p>
          </div>
          <div data-ui-surface="true" className={profileFieldCard}>
            <p className="ui-card-label">{t('profile.company_code')}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{user?.company_code ?? '-'}</p>
          </div>
          <div data-ui-surface="true" className={profileFieldCard}>
            <p className="ui-card-label">{t('profile.job_title')}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{user?.job_title ?? '-'}</p>
          </div>
          <div data-ui-surface="true" className={profileFieldCard}>
            <p className="ui-card-label">{t('profile.email')}</p>
            <p className="mt-2 text-base font-semibold break-all text-[var(--foreground)]">{user?.email ?? '-'}</p>
          </div>
          <div data-ui-surface="true" className={profileFieldCard}>
            <p className="ui-card-label">{t('profile.status')}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={cn('status-dot', user?.is_active ? 'status-dot-success' : 'status-dot-muted')} />
              <p className="text-base font-semibold text-[var(--foreground)]">
                {user?.is_active ? t('status.active', 'Active') : t('status.inactive', 'Inactive')}
              </p>
            </div>
          </div>
          {isEditingMember && (
            <>
              <div data-ui-surface="true" className={profileFieldCard}>
                <p className="ui-input-label">{t('profile.name')}</p>
                <Input value={memberForm.name} onChange={(e) => updateMemberForm('name', e.target.value)} className="mt-2" />
              </div>
              <div data-ui-surface="true" className={profileFieldCard}>
                <p className="ui-input-label">{t('profile.surname')}</p>
                <Input value={memberForm.surname} onChange={(e) => updateMemberForm('surname', e.target.value)} className="mt-2" />
              </div>
              <div data-ui-surface="true" className={profileFieldCard}>
                <p className="ui-input-label">
                  {t('profile.current_password', 'Current password')}
                </p>
                <Input
                  type="password"
                  value={memberForm.current_password}
                  onChange={(e) => updateMemberForm('current_password', e.target.value)}
                  className="mt-2"
                  placeholder={t('profile.current_password_hint', 'Fill only if changing password')}
                />
              </div>
              <div data-ui-surface="true" className={profileFieldCard}>
                <p className="ui-input-label">
                  {t('profile.new_password', 'New password')}
                </p>
                <Input
                  type="password"
                  value={memberForm.new_password}
                  onChange={(e) => updateMemberForm('new_password', e.target.value)}
                  className="mt-2"
                  placeholder={t('profile.new_password_hint', 'Leave blank to keep current password')}
                />
              </div>
            </>
          )}
        </div>

        <div data-ui-surface="true" className="mt-4 rounded-[18px] bg-[var(--muted-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-card-label">{t('profile.permissions')}</p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {activePermissions.length} {t('profile.enabled')}
              </p>
            </div>
            <Badge className="rounded-full border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 tracking-[0.08em] text-[var(--foreground)] uppercase">
              {env.appEnv}
            </Badge>
          </div>
          {activePermissions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {activePermissions.map((permission) => (
                <Badge
                  key={permission}
                  className="rounded-full border-[var(--blue-border)] bg-[var(--blue-dim)] px-2.5 py-1 tracking-[0.08em] text-[var(--blue-text)] uppercase"
                >
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">{t('profile.no_active_permissions')}</p>
          )}
        </div>
      </Dialog>
    </>
  )
}
