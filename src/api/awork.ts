import { z } from 'zod'
import { textToHtml } from '../text/html.js'
import type { Client } from './client.js'
import {
  CommentSchema,
  ProjectSchema,
  TaskSchema,
  TaskStatusSchema,
  UserSchema,
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
  user(id: string): Promise<User | null>
  changeStatus(taskId: string, statusId: string): Promise<void>
  addComment(taskId: string, text: string): Promise<void>
}

const enc = encodeURIComponent

export function createAworkApi(client: Client): AworkApi {
  const users = new Map<string, Promise<User | null>>()

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
  }
}
