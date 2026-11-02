import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppShell } from '../../app/hooks/useAppShell'
import { useLocale } from '../../app/hooks/useLocale'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { authService } from '../../shared/api/services/auth.service'
import { env } from '../../shared/config/env'
import { useAsyncData } from '../../shared/hooks/useAsyncData'
import { cn } from '../../shared/lib/cn'
import { canReadManagedProjects, getAccessibleNavigation, hasPermission } from '../../shared/lib/permissions'
import { getApiErrorMessage } from '../../shared/lib/api-error'
import { resolveMediaUrl } from '../../shared/lib/media-url'
import { useToast } from '../../shared/toast/useToast'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { Dialog } from '../../shared/ui/dialog'
import { Input } from '../../shared/ui/input'
import { PROJECTS_NAVIGATION_UPDATED_EVENT } from '../../features/projects/lib/navigationSync'
import { NavGlyph } from './NavGlyph'
import { getNavigationGlyphName, type GlyphName } from './navGlyphMap'

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
  'group flex w-full items-center gap-3 rounded-[13px] px-3 py-[11px] text-sm transition-colors'
const sidebarItemInactive =
  'font-medium text-[var(--shell-nav-text)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--shell-nav-hover-text)]'
const sidebarItemActive =
  'bg-[var(--primary)] font-semibold text-white shadow-[var(--elev-nav)]'

type OutboundSidebarItem = {
  to: string
  label: string
  glyph: GlyphName
  isActive: (pathname: string) => boolean
}

const sidebarSectionLabel =
  'px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--caption)]'

const profileFieldCard = 'rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-5 py-4'

export function AppSidebar() {
  const location = useLocation()
  const { closeSidebar, isSidebarCollapsed, isSidebarOpen, toggleSidebar, toggleSidebarCollapsed } = useAppShell()
  const { t } = useLocale()
  const { showToast } = useToast()
  const { user, refreshUser } = useAuth()
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

  const isOutboundCrmRoute = location.pathname === '/outbound-crm' || location.pathname.startsWith('/outbound-crm/')
  const outboundNavigation: OutboundSidebarItem[] = [
    {
      to: '/outbound-crm',
      label: t('outbound_crm.sidebar.leads', 'Leads'),
      glyph: 'crm',
      isActive: (pathname) => pathname === '/outbound-crm' || pathname.startsWith('/outbound-crm/customers/'),
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
  const visibleNavigation = getAccessibleNavigation(user, { sidebarOnly: true })
  const sidebarNavigation = useMemo(() => visibleNavigation, [visibleNavigation])
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

  return (
    <>
      <button
        type="button"
        aria-label={t('shell.close_navigation_overlay')}
        onClick={closeSidebar}
        className={cn(
          'shell-scrim fixed inset-0 z-30 bg-[rgba(14,21,37,0.32)] lg:hidden',
          isSidebarOpen ? 'shell-scrim--open pointer-events-auto' : 'shell-scrim--closed pointer-events-none',
        )}
      />

      <aside
        className={cn(
          'shell-sidebar fixed inset-y-0 left-0 z-40 w-[min(88vw,var(--sidebar-w))] lg:sticky lg:inset-auto lg:top-0 lg:h-screen lg:w-[var(--sidebar-w)] lg:self-start lg:overflow-hidden',
          isSidebarOpen ? 'shell-sidebar--open' : 'shell-sidebar--closed',
          isSidebarCollapsed
            ? 'lg:pointer-events-none lg:w-0! lg:opacity-0'
            : 'lg:opacity-100',
        )}
      >
        <div className="flex h-full flex-col gap-[22px] overflow-hidden bg-[var(--sidebar-background)] px-4 py-[22px]">
          <button
            type="button"
            onClick={handleSidebarToggle}
            aria-label={t('shell.toggle_navigation')}
            className="flex items-center gap-2.5 px-2 text-left"
          >
            <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-[15px] font-bold tracking-[-0.02em] text-white">
              {getInitials(user?.name, user?.surname)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[18px] font-bold tracking-[-0.02em] text-[var(--shell-app-name-color)]">
                {env.appName}
              </span>
              <span className="-mt-0.5 truncate text-[11px] text-[var(--muted)]">
                {isOutboundCrmRoute ? 'Outbound CRM' : (user?.job_title?.trim() || user?.role || t('shell.user'))}
              </span>
            </span>
          </button>

          {isOutboundCrmRoute ? (
            <div className="-mx-1 flex-1 overflow-x-hidden overflow-y-auto px-1">
              <p className={sidebarSectionLabel}>Outbound CRM</p>

              <div className="flex flex-col gap-1">
                {outboundNavigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    aria-label={item.label}
                    className={cn(sidebarItemBase, item.isActive(location.pathname) ? sidebarItemActive : sidebarItemInactive)}
                  >
                    <NavGlyph name={item.glyph} />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                  </NavLink>
                ))}
              </div>

              {hasPermission(user, 'crm') ? (
                <div className="mt-5 border-t border-[var(--border)] pt-4">
                  <NavLink
                    to="/crm"
                    aria-label={t('outbound_crm.header.back_to_crm', 'Main CRM')}
                    className={cn(sidebarItemBase, sidebarItemInactive)}
                  >
                    <NavGlyph name="exit" />
                    <span className="flex-1 truncate text-left">{t('outbound_crm.header.back_to_crm', 'Main CRM')}</span>
                  </NavLink>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="-mx-1 flex-1 overflow-x-hidden overflow-y-auto px-1">
              <p className={sidebarSectionLabel}>{t('shell.menu')}</p>

              <div className="flex flex-col gap-1">
                {sidebarNavigation.map((item) => {
                  const itemLabel = getNavigationLabel(item.to, item.label)

                  if (item.to === '/projects') {
                    return (
                      <div key={item.to} className="flex flex-col gap-1">
                        <div className="relative">
                          <NavLink
                            to={item.to}
                            aria-label={itemLabel}
                            onClick={() => setIsProjectsExpanded(true)}
                            className={({ isActive }) =>
                              cn(
                                sidebarItemBase,
                                isActive || isProjectsRoute ? sidebarItemActive : sidebarItemInactive,
                                'pr-16',
                              )
                            }
                          >
                            <NavGlyph name={getNavigationGlyphName(item.to)} />
                            <span className="flex-1 truncate text-left">{itemLabel}</span>
                            {sidebarProjects.length > 0 && (
                              <span
                                className={cn(
                                  'ml-auto rounded-full px-[7px] py-0.5 text-[11px] font-bold',
                                  isProjectsRoute
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[var(--lime)] text-[var(--lime-ink)]',
                                )}
                              >
                                {sidebarProjects.length}
                              </span>
                            )}
                          </NavLink>

                          <button
                            type="button"
                            onClick={toggleProjectsExpanded}
                            aria-label={isProjectsExpanded ? t('shell.collapse_projects') : t('shell.expand_projects')}
                            className={cn(
                              'absolute top-1/2 right-2.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg transition-colors',
                              isProjectsRoute
                                ? 'text-white hover:bg-white/15'
                                : 'text-[var(--muted)] hover:bg-[var(--shell-nav-hover-bg)] hover:text-[var(--foreground)]',
                            )}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              className={cn('h-3.5 w-3.5 transition-transform duration-200', isProjectsExpanded && 'rotate-180')}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>

                        {isProjectsExpanded && (
                          <div className="ml-4 flex flex-col gap-1 border-l border-[var(--border)] pl-3">
                            {projectsQuery.isLoading ? (
                              Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="skeleton h-9" />
                              ))
                            ) : projectsQuery.isError ? (
                              <button
                                type="button"
                                onClick={() => void projectsQuery.refetch()}
                                className={cn(
                                  sidebarItemBase,
                                  'font-medium text-[var(--danger-text)] hover:bg-[var(--danger-dim)]',
                                )}
                              >
                                <span className="truncate">
                                  {t('shell.failed_load_projects')} — {t('shell.retry')}
                                </span>
                              </button>
                            ) : sidebarProjects.length === 0 ? (
                              <div className={cn(sidebarItemBase, 'font-medium text-[var(--muted)]')}>
                                <span className="truncate">{t('shell.no_projects')}</span>
                              </div>
                          ) : (
                              sidebarProjects.map((project) => {
                                const isActiveProject =
                                  location.pathname === `/projects/${project.id}` ||
                                  location.pathname.startsWith(`/projects/${project.id}/`) ||
                                  location.pathname.startsWith(`/boards/`)
                                const openCount = openTaskCountByProject.get(project.id) ?? 0

                                return (
                                  <NavLink
                                    key={project.id}
                                    to={`/projects/${project.id}`}
                                    className={({ isActive }) =>
                                      cn(
                                        sidebarItemBase,
                                        isActive || isActiveProject ? sidebarItemActive : sidebarItemInactive,
                                        'gap-2.5 py-2 pl-3',
                                      )
                                    }
                                  >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
                                    <span className="flex-1 truncate text-left">{project.project_name}</span>
                                    {openCount > 0 && (
                                      <span
                                        className={cn(
                                          'ml-auto rounded-full px-[7px] py-0.5 text-[11px] font-bold',
                                          isActiveProject
                                            ? 'bg-white/20 text-white'
                                            : 'bg-[var(--lime)] text-[var(--lime-ink)]',
                                        )}
                                      >
                                        {openCount}
                                      </span>
                                    )}
                                  </NavLink>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-label={itemLabel}
                      className={({ isActive }) =>
                        cn(sidebarItemBase, isActive ? sidebarItemActive : sidebarItemInactive)
                      }
                    >
                      <NavGlyph name={getNavigationGlyphName(item.to)} />
                      <span className="flex-1 truncate text-left">{itemLabel}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={openMemberDialog}
            disabled={!user}
            className="flex items-center gap-3 rounded-[18px] bg-[var(--surface-inverse)] p-4 text-left transition-opacity hover:opacity-95 disabled:cursor-default disabled:opacity-80"
            aria-label={t('profile.member_details')}
          >
            {resolvedUserProfileImage ? (
              <img
                src={resolvedUserProfileImage}
                alt={user ? `${user.name} ${user.surname}` : t('shell.authenticated_user')}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-xs font-bold text-[var(--lime-ink)]">
                {getInitials(user?.name, user?.surname)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">
                {user ? `${user.name} ${user.surname}` : t('shell.authenticated_user')}
              </p>
              <p className="truncate text-[11.5px] text-[var(--on-inverse-muted)]">
                {user?.email ?? user?.role ?? t('shell.user')}
              </p>
            </div>
          </button>
        </div>
      </aside>

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
