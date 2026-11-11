import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { authService } from '../../shared/api/services/auth.service'
import { env } from '../../shared/config/env'
import { type AppLocale, localeLabels } from '../../shared/i18n/translations'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { cn } from '../../shared/lib/cn'
import { canReadManagedProjects, getAccessibleNavigation, resolveNavRoute } from '../../shared/lib/permissions'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { resolveMediaUrl } from '../../shared/lib/media-url'
import { useToast } from '../../shared/toast/useToast'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { Dialog } from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { BrandMark, BrandWordmark } from '../../shared/ui/brand-logo'
import { PROJECTS_NAVIGATION_UPDATED_EVENT } from '../../features/projects/lib/navigationSync'
import { projectGradient, projectHue, projectInitial } from '../../features/projects/lib/projectLook'
import { NavGlyph } from './NavGlyph'
import { getNavigationGlyphName, type GlyphName } from './navGlyphMap'
import { OPEN_PROFILE_EVENT } from './profileEvents'

const DONE_COLUMN_PATTERN = /\b(done|complete|completed|closed|finished|resolved)\b/i

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
const sidebarSubItem =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[13px] leading-5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35'
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

function navGroupOf(path: string): NavGroupKey {
  if (path === '/member/dashboard' || path === '/ceo/dashboard') return 'main'
  if (path.startsWith('/crm') || path.startsWith('/outbound-crm') || path.startsWith('/telephony')) return 'sales'
  if (path.startsWith('/projects')) return 'work'
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
      return consolidate(access.navigation.map((group, index) => {
        const key = rbacGroupKeys[group.group.trim().toLowerCase()]
        return {
          key: `${group.group}-${index}`,
          label: key ? t(`shell.group.${key}`, groupFallback[key]) : group.group,
          items: group.items.map((item) => ({ to: resolveNavRoute(item), label: item.display_name, icon: item.icon })),
        }
      }), t)
    }
    const legacy = getAccessibleNavigation(user, { sidebarOnly: true })
    return consolidate(groupOrder
      .map((group) => ({ key: group, label: t(`shell.group.${group}`, groupFallback[group]), items: legacy.filter((item) => navGroupOf(item.to) === group) }))
      .filter((entry) => entry.items.length > 0), t)
  }, [access, t, user])
  const sidebarNavigation = useMemo(() => sidebarGroups.flatMap((group) => group.items), [sidebarGroups])
  const hasProjectsAccess = sidebarNavigation.some((item) => item.to === '/projects')
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
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(isProjectsRoute)
  const shouldLoadProjects = hasProjectsAccess && Boolean(user) && (isProjectsExpanded || isProjectsRoute)
  const [projectsRefreshKey, setProjectsRefreshKey] = useState(0)
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

  const projectsQuery = useAsyncData(
    async () => {
      const { projectsService } = await import('../../shared/api/services/projects.service')
      return projectsService.listReadableProjects(user?.id)
    },
    [projectsRefreshKey, shouldLoadProjects, user?.id],
    { enabled: shouldLoadProjects },
  )

  const isCeoOrAdmin = canReadManagedProjects(user)

  const openCardsQuery = useAsyncData(
    async () => {
      if (!user?.id) return { cards: [], total_count: 0 }
      const { projectsService } = await import('../../shared/api/services/projects.service')
      if (isCeoOrAdmin) {
        const users = await projectsService.getAllUsers()
        const results = await Promise.allSettled(users.map((u) => projectsService.listUserOpenCards(u.id)))
        const all = results.flatMap((r) => r.status === 'fulfilled' ? r.value.cards : [])
        const unique = new Map(all.map((c) => [c.id, c]))
        return { cards: Array.from(unique.values()), total_count: unique.size }
      }
      return projectsService.listUserOpenCards(user.id)
    },
    [projectsRefreshKey, shouldLoadProjects, user?.id, isCeoOrAdmin],
    { enabled: shouldLoadProjects },
  )

  const openTaskCountByProject = useMemo(() => {
    const map = new Map<number, number>()
    for (const card of openCardsQuery.data?.cards ?? []) {
      const isDone = card.completed_at !== null || DONE_COLUMN_PATTERN.test(card.column_name.trim())
      if (!isDone) {
        map.set(card.project_id, (map.get(card.project_id) ?? 0) + 1)
      }
    }
    return map
  }, [openCardsQuery.data?.cards])

  const sidebarProjects = useMemo(
    () =>
      [...(projectsQuery.data?.projects ?? [])].sort((left, right) =>
        left.project_name.localeCompare(right.project_name),
      ),
    [projectsQuery.data?.projects],
  )

  const resolvedUserProfileImage = resolveMediaUrl(user?.profile_image) ?? user?.profile_image ?? null
  const profilePreviewUrl = useMemo(() => {
    if (!profileImageFile) return resolvedUserProfileImage
    return URL.createObjectURL(profileImageFile)
  }, [profileImageFile, resolvedUserProfileImage])

  useEffect(() => { closeSidebar() }, [closeSidebar, location.pathname])
  useEffect(() => { if (isProjectsRoute) setIsProjectsExpanded(true) }, [isProjectsRoute])

  useEffect(() => {
    if (!hasProjectsAccess) return
    function handleProjectsNavigationUpdated() {
      setProjectsRefreshKey((c) => c + 1)
    }
    window.addEventListener(PROJECTS_NAVIGATION_UPDATED_EVENT, handleProjectsNavigationUpdated)
    return () => window.removeEventListener(PROJECTS_NAVIGATION_UPDATED_EVENT, handleProjectsNavigationUpdated)
  }, [hasProjectsAccess])

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

  function toggleProjectsExpanded() {
    setIsProjectsExpanded((c) => !c)
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

    if (item.to === '/projects' && rail) {
      return (
        <NavLink key={item.to} to={item.to} aria-label={itemLabel} {...tipProps(itemLabel)} className={cn(sidebarItemBase, railItem, isProjectsRoute ? sidebarItemActive : sidebarItemInactive)}>
          <NavGlyph name={glyphFor(item)} className={sidebarIcon} />
          <span className="nav-label">{itemLabel}</span>
        </NavLink>
      )
    }

    if (item.to === '/projects') {
      return (
        <div key={item.to} className="flex flex-col gap-0.5">
          <div className="relative">
            <NavLink
              to={item.to}
              aria-label={itemLabel}
              onClick={() => setIsProjectsExpanded(true)}
              title={itemLabel}
              className={({ isActive }) => cn(sidebarItemBase, isActive || isProjectsRoute ? sidebarItemActive : sidebarItemInactive, 'pr-[72px]')}
            >
              <NavGlyph name={glyphFor(item)} className={sidebarIcon} />
              <span className="flex-1 truncate text-left">{itemLabel}</span>
              {sidebarProjects.length > 0 && (
                <span className={cn('ml-auto rounded-full px-[7px] py-px text-[11px] font-semibold tabular-nums', isProjectsRoute ? 'bg-white/20 text-white' : 'bg-[var(--sb-hover)] text-[var(--sb-text)]')}>
                  {sidebarProjects.length}
                </span>
              )}
            </NavLink>
            <button
              type="button"
              onClick={toggleProjectsExpanded}
              aria-label={isProjectsExpanded ? t('shell.collapse_projects') : t('shell.expand_projects')}
              aria-expanded={isProjectsExpanded}
              className={cn(
                'absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] transition-colors',
                isProjectsRoute ? 'text-white hover:bg-white/15' : 'text-[var(--sb-icon)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-strong)]',
              )}
            >
              <ChevronDown size={15} className={cn('transition-transform duration-200', isProjectsExpanded && 'rotate-180')} />
            </button>
          </div>

          {/* Projects open below with a smooth height animation; each one with its own colour tile */}
          <div className="sb-collapse" data-open={isProjectsExpanded}>
            <div>
              <div className="mt-1 mb-1.5 ml-1 flex flex-col gap-0.5 rounded-[14px] bg-[var(--sb-hover)] p-1.5">
                {projectsQuery.isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-9 rounded-[10px]" />)
                ) : projectsQuery.isError ? (
                  <button type="button" onClick={() => void projectsQuery.refetch()} className={cn(sidebarSubItem, 'text-[var(--danger-text)] hover:bg-[var(--danger-dim)]')}>
                    <span className="truncate">{t('shell.failed_load_projects')} — {t('shell.retry')}</span>
                  </button>
                ) : sidebarProjects.length === 0 ? (
                  <div className={cn(sidebarSubItem, 'text-[var(--sb-label)]')}>
                    <span className="truncate">{t('shell.no_projects')}</span>
                  </div>
                ) : (
                  sidebarProjects.map((project, index) => {
                    const isActiveProject =
                      location.pathname === `/projects/${project.id}` ||
                      location.pathname.startsWith(`/projects/${project.id}/`)
                    const openCount = openTaskCountByProject.get(project.id) ?? 0
                    const hue = projectHue(project.project_name)

                    return (
                      <NavLink
                        key={project.id}
                        to={`/projects/${project.id}`}
                        style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                        className={({ isActive }) => cn(
                          'kb-in group/proj flex w-full items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-[13px] leading-5 font-medium transition-[background-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35',
                          isActive || isActiveProject
                            ? 'bg-[var(--sb-bg)] font-semibold text-[var(--sb-strong)] shadow-[0_6px_16px_-10px_rgba(14,21,37,0.45)]'
                            : 'text-[var(--sb-text)] hover:bg-[var(--sb-bg)] hover:text-[var(--sb-strong)]',
                        )}
                      >
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform duration-300 group-hover/proj:scale-110 group-hover/proj:-rotate-6"
                          style={{ background: projectGradient(hue) }}
                        >
                          {projectInitial(project.project_name)}
                        </span>
                        <span className="flex-1 truncate text-left">{project.project_name}</span>
                        {openCount > 0 ? (
                          <span className="ml-auto rounded-full px-[7px] py-px text-[11px] font-semibold tabular-nums text-white" style={{ background: `hsl(${hue} 70% 52%)` }}>{openCount}</span>
                        ) : null}
                      </NavLink>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
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
