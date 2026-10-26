import {
  type CardPriority,
  type ProjectRecord,
  type UserOpenCardRecord,
} from '../../../shared/api/services/projects.service'

export type MemberTaskOverviewItem = {
  cardId: number
  title: string
  boardId: number
  boardName: string
  columnName: string
  projectId: number
  projectName: string
  dueDate: string | null
  priority: CardPriority | null
}

export type MemberProjectOverviewItem = {
  projectId: number
  projectName: string
  projectDescription: string | null
  boardCount: number
  taskCount: number
  tasks: MemberTaskOverviewItem[]
}

export type MemberProjectOverview = {
  projectCount: number
  boardCount: number
  taskCount: number
  projects: MemberProjectOverviewItem[]
}

export function buildMemberProjectOverview(
  projects: ProjectRecord[],
  cards: UserOpenCardRecord[],
): MemberProjectOverview {
  const tasksByProject = new Map<number, MemberTaskOverviewItem[]>()

  for (const card of cards) {
    const nextTask: MemberTaskOverviewItem = {
      cardId: card.id,
      title: card.title,
      boardId: card.board_id,
      boardName: card.board_name,
      columnName: card.column_name,
      projectId: card.project_id,
      projectName: card.project_name,
      dueDate: card.due_date,
      priority: card.priority,
    }

    const currentTasks = tasksByProject.get(card.project_id) ?? []
    currentTasks.push(nextTask)
    tasksByProject.set(card.project_id, currentTasks)
  }

  const projectsWithTasks = projects
    .map<MemberProjectOverviewItem>((project) => {
      const tasks = [...(tasksByProject.get(project.id) ?? [])].sort((left, right) => {
        if (left.dueDate && right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate)
        }

        if (left.dueDate) {
          return -1
        }

        if (right.dueDate) {
          return 1
        }

        return left.title.localeCompare(right.title)
      })

      return {
        projectId: project.id,
        projectName: project.project_name,
        projectDescription: project.project_description,
        boardCount: project.boards_count,
        taskCount: tasks.length,
        tasks,
      }
    })
    .sort((left, right) => {
      if (right.taskCount !== left.taskCount) {
        return right.taskCount - left.taskCount
      }

      return left.projectName.localeCompare(right.projectName)
    })

  return {
    projectCount: projectsWithTasks.length,
    boardCount: projectsWithTasks.reduce((total, project) => total + project.boardCount, 0),
    taskCount: projectsWithTasks.reduce((total, project) => total + project.taskCount, 0),
    projects: projectsWithTasks,
  }
}
