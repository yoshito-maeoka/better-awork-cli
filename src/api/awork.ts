import { z } from 'zod'
import { textToHtml } from '../text/html.js'
import type { Client } from './client.js'
import {
  ChecklistItemSchema,
  CommentSchema,
  ProjectSchema,
  TaskSchema,
  TaskStatusSchema,
  UserSchema,
  type ChecklistItem,
  type Comment,
  type Project,
  type Task,
  type TaskStatus,
  type User,
} from './schemas.js'

export interface AworkApi {
  me(): Promise<User>
  users(): Promise<User[]>
  projects(): Promise<Project[]>
  project(id: string): Promise<Project>
  projectTasks(projectId: string): Promise<Task[]>
  task(id: string): Promise<Task>
  taskStatuses(projectId: string): Promise<TaskStatus[]>
  comments(taskId: string): Promise<Comment[]>
  checklist(taskId: string): Promise<ChecklistItem[]>
  user(id: string): Promise<User | null>
  changeStatus(taskId: string, statusId: string): Promise<void>
  addComment(taskId: string, text: string): Promise<void>
  /** Link to the task in the awork web app. */
  taskUrl(taskId: string): Promise<string>
}

const enc = encodeURIComponent

/** The workspace's https origin, e.g. https://acme.awork.com, from a /me payload. */
function workspaceOrigin(me: User): string {
  const raw = me.workspace?.url
  const url = raw && URL.canParse(raw) ? new URL(raw) : undefined
  if (url?.protocol !== 'https:') throw new Error('awork did not return a valid workspace URL for this token.')
  return url.origin
}

export function createAworkApi(client: Client): AworkApi {
  const users = new Map<string, Promise<User | null>>()
  let origin: Promise<string> | undefined

  const workspace = (): Promise<string> => {
    origin ??= client.get('/me', UserSchema).then(workspaceOrigin)
    // Do not cache a failure; the next attempt should ask again.
    origin.catch(() => {
      origin = undefined
    })
    return origin
  }

  return {
    me: () => client.get('/me', UserSchema),
    users: () => client.paged('/users', UserSchema),
    projects: () => client.paged('/projects', ProjectSchema),
    project: (id) => client.get(`/projects/${enc(id)}`, ProjectSchema),
    projectTasks: (projectId) => client.paged(`/projects/${enc(projectId)}/projecttasks`, TaskSchema),
    task: (id) => client.get(`/tasks/${enc(id)}`, TaskSchema),
    taskStatuses: async (projectId) => {
      const statuses = await client.get(`/projects/${enc(projectId)}/taskstatuses`, z.array(TaskStatusSchema))
      return [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    },
    comments: (taskId) => client.get(`/tasks/${enc(taskId)}/comments`, z.array(CommentSchema)),
    checklist: (taskId) => client.get(`/tasks/${enc(taskId)}/checklistitems`, z.array(ChecklistItemSchema)),
    user: (id) => {
      const cached = users.get(id)
      if (cached) return cached
      // A missing author should not break the task view; show "Unknown" instead.
      const pending = client.get(`/users/${enc(id)}`, UserSchema).catch(() => null)
      users.set(id, pending)
      return pending
    },
    changeStatus: async (taskId, statusId) => {
      await client.post('/tasks/changestatuses', [{ taskId, statusId }])
    },
    addComment: async (taskId, text) => {
      if (!text.trim()) throw new Error('Comment is empty.')
      await client.post(`/tasks/${enc(taskId)}/comments`, { message: textToHtml(text) })
    },
    taskUrl: async (taskId) => `${await workspace()}/tasks/${enc(taskId)}/details`,
  }
}
