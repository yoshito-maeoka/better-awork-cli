import { z } from 'zod'

// awork payloads carry many more fields; we only validate what we use and let the rest pass through.

export const UserSchema = z.looseObject({
  id: z.string(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  userContactInfos: z.array(z.looseObject({ type: z.string().nullish(), value: z.string().nullish() })).nullish(),
  /** Only present on /me: the workspace the token belongs to. */
  workspace: z.looseObject({ url: z.string().nullish() }).nullish(),
})
export type User = z.infer<typeof UserSchema>

export const TaskStatusSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  order: z.number().nullish(),
})
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  taskStatus: TaskStatusSchema,
  dueOn: z.string().nullish(),
  assignees: z.array(UserSchema).nullish(),
  assigneeId: z.string().nullish(),
  projectId: z.string().nullish(),
  updatedOn: z.string().nullish(),
})
export type Task = z.infer<typeof TaskSchema>

export const ProjectSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  projectStatus: z.looseObject({ type: z.string().nullish() }).nullish(),
})
export type Project = z.infer<typeof ProjectSchema>

export const CommentSchema = z.looseObject({
  id: z.string(),
  message: z.string().nullish(),
  userId: z.string().nullish(),
  createdOn: z.string().nullish(),
})
export type Comment = z.infer<typeof CommentSchema>

export const userName = (user: Pick<User, 'firstName' | 'lastName'> | undefined): string =>
  user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown' : 'Unknown'
