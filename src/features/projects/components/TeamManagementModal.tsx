import { useEffect, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { projectsService, type ProjectTeamRecord } from '../../../shared/api/services/projects.service'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { useConfirm } from '../../../shared/confirm/useConfirm'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { Skeleton } from '../../../shared/ui/skeleton'
import { Textarea } from '../../../shared/ui/textarea'
import { useAuth } from '../../auth/hooks/useAuth'
import { AvatarGroup } from './Avatar'
import { MemberSelector } from './MemberSelector'

type TeamFormValues = {
  name: string
  description: string
  memberIds: number[]
}

const emptyValues: TeamFormValues = {
  name: '',
  description: '',
  memberIds: [],
}

export function TeamManagementModal({ open, onClose, onChanged }: {
  open: boolean
  onClose: () => void
  onChanged?: () => Promise<unknown> | unknown
}) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const { can } = useAuth()
  const canCreateTeam = can('projects', 'create')
  const canEditTeam = can('projects', 'edit')
  const canDeleteTeam = can('projects', 'delete')
  const teamsQuery = useAsyncData(() => projectsService.listTeams(), [open], { enabled: open })
  const usersQuery = useAsyncData(() => projectsService.getAllUsers(), [open], { enabled: open })
  const [editingTeam, setEditingTeam] = useState<ProjectTeamRecord | null>(null)
  const [values, setValues] = useState<TeamFormValues>(emptyValues)
  const [isSaving, setIsSaving] = useState(false)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (!open) {
      setEditingTeam(null)
      setValues(emptyValues)
      setNameError('')
    }
  }, [open])

  function beginCreate() {
    setEditingTeam(null)
    setValues(emptyValues)
    setNameError('')
  }

  function beginEdit(team: ProjectTeamRecord) {
    setEditingTeam(team)
    setValues({
      name: team.name,
      description: team.description ?? '',
      memberIds: team.members.map((member) => member.id),
    })
    setNameError('')
  }

  async function saveTeam() {
    const name = values.name.trim()
    if (!name) {
      setNameError(t('projects.team_name_required', 'Team name is required'))
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        name,
        description: values.description.trim() || undefined,
        member_ids: values.memberIds,
      }

      if (editingTeam) {
        await projectsService.updateTeam(editingTeam.id, payload)
        showToast({ title: t('projects.team_updated', 'Team updated'), tone: 'success' })
      } else {
        await projectsService.createTeam(payload)
        showToast({ title: t('projects.team_created', 'Team created'), tone: 'success' })
      }

      beginCreate()
      await Promise.all([teamsQuery.refetch(), Promise.resolve(onChanged?.())])
    } catch {
      showToast({ title: t('projects.team_save_failed', 'Failed to save team'), tone: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  async function removeTeam(team: ProjectTeamRecord) {
    const approved = await confirm({
      title: t('projects.delete_team', 'Delete team?'),
      description: t('projects.delete_team_description', 'This team will be removed from project assignments.'),
      tone: 'danger',
    })
    if (!approved) return

    try {
      await projectsService.deleteTeam(team.id)
      if (editingTeam?.id === team.id) beginCreate()
      showToast({ title: t('projects.team_deleted', 'Team deleted'), tone: 'success' })
      await Promise.all([teamsQuery.refetch(), Promise.resolve(onChanged?.())])
    } catch {
      showToast({ title: t('projects.team_delete_failed', 'Failed to delete team'), tone: 'error' })
    }
  }

  const teams = teamsQuery.data?.teams ?? []
  const users = usersQuery.data ?? []
  // The form doubles as "new team" and "edit team" — show it only for the action the user may perform.
  const showForm = editingTeam ? canEditTeam : canCreateTeam

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('projects.teams', 'Teams')}
      description={t('projects.teams_description', 'Group people once, then attach the team to projects.')}
      size="xl"
      footer={<Button variant="ghost" size="md" onClick={onClose}>{t('projects.close', 'Close')}</Button>}
    >
      <div className={showForm ? 'grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_360px]' : 'grid gap-[18px]'}>
        <div className="min-w-0">
          {teamsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} rounded="xl" className="h-28" />)}
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-[18px] bg-[var(--muted-surface)] p-8 text-center">
              <p className="text-sm font-semibold text-[var(--foreground)]">{t('projects.no_teams', 'No teams yet')}</p>
              <p className="mt-1.5 text-[12.5px] text-[var(--muted)]">{t('projects.create_team_hint', 'Create a team to reuse its members across projects.')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div key={team.id} className="rounded-[18px] bg-[var(--accent-soft)] p-[18px] transition-colors hover:bg-[var(--input-surface-hover)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{team.name}</p>
                      {team.description ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-[var(--muted)]">{team.description}</p> : null}
                    </div>
                    {canEditTeam || canDeleteTeam ? (
                      <div className="flex shrink-0 gap-1">
                        {canEditTeam ? <Button type="button" variant="ghost" size="sm" onClick={() => beginEdit(team)}>{t('projects.edit', 'Edit')}</Button> : null}
                        {canDeleteTeam ? <Button type="button" variant="ghost" size="sm" className="text-[var(--danger-text)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger-text)]" onClick={() => void removeTeam(team)}>{t('projects.delete', 'Delete')}</Button> : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-hover)] pt-3.5">
                    {team.members.length > 0 ? <AvatarGroup users={team.members} max={5} size="xs" /> : <span className="text-[12px] text-[var(--muted)]">{t('projects.no_members', 'No members')}</span>}
                    <span className="text-[12px] font-medium text-[var(--muted)]">{team.members.length} {t('projects.members', 'members')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showForm ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void saveTeam()
            }}
            className="flex flex-col gap-[18px] rounded-[18px] bg-[var(--accent-soft)] p-[18px]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{editingTeam ? t('projects.edit_team', 'Edit team') : t('projects.new_team', 'New team')}</h3>
              {editingTeam ? <Button type="button" variant="ghost" size="sm" onClick={beginCreate}>{t('projects.cancel_edit', 'Cancel')}</Button> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('projects.team_name', 'Team name')}</Label>
              <Input value={values.name} onChange={(event) => { setValues((current) => ({ ...current, name: event.target.value })); setNameError('') }} placeholder={t('projects.team_name_placeholder', 'Frontend team')} className="bg-[var(--surface)] hover:bg-[var(--surface)]" />
              {nameError ? <p className="text-[12.5px] text-[var(--danger-text)]">{nameError}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('projects.description', 'Description')}</Label>
              <Textarea value={values.description} onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))} rows={2} placeholder={t('projects.team_description_placeholder', 'What this team owns')} className="bg-[var(--surface)] hover:bg-[var(--surface)]" />
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <Label>{t('projects.members_selected', 'Members ({count} selected)', { count: values.memberIds.length })}</Label>
              {usersQuery.isLoading ? <p className="py-3 text-[12.5px] text-[var(--muted)]">{t('projects.loading_members', 'Loading members...')}</p> : <MemberSelector allUsers={users} selectedIds={values.memberIds} onChange={(memberIds) => setValues((current) => ({ ...current, memberIds }))} disabled={isSaving} />}
            </div>
            <Button type="submit" variant="primary" size="md" loading={isSaving}>{editingTeam ? t('projects.save_changes', 'Save changes') : t('projects.create_team', 'Create team')}</Button>
          </form>
        ) : null}
      </div>
    </Dialog>
  )
}
