import type { AworkApi } from '../api/awork.js'
import type { Task } from '../api/schemas.js'

/** Parallel comment requests while scanning; the client already backs off on 429. */
export const MENTION_SCAN_CONCURRENCY = 5

export interface MentionScan {
  /** Tasks with at least one comment mentioning the user. */
  mentioned: ReadonlySet<string>
  /** Tasks whose comments were read successfully (mentioned or not). */
  checked: ReadonlySet<string>
  /** Tasks whose comments could not be loaded. */
  failed: number
}

/** awork stores a mention in comment HTML as `~[userId:<uuid>]`. */
export function mentionsUser(message: string | null | undefined, userId: string): boolean {
  if (!message) return false
  return message.toLowerCase().includes(`~[userid:${userId.toLowerCase()}]`)
}

type Outcome = { taskId: string; isMentioned: boolean } | { taskId: string; error: unknown }

async function checkTask(api: AworkApi, taskId: string, userId: string): Promise<Outcome> {
  try {
    const comments = await api.comments(taskId)
    return { taskId, isMentioned: comments.some((c) => mentionsUser(c.message, userId)) }
  } catch (error: unknown) {
    return { taskId, error }
  }
}

/** Run `work` over `items` with at most `limit` calls in flight, keeping input order. */
async function mapLimited<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker))
  return results
}

/** Read every task's comments and report which ones mention the user. */
export async function findMentionedTaskIds(
  api: AworkApi,
  tasks: readonly Task[],
  userId: string,
  concurrency: number = MENTION_SCAN_CONCURRENCY,
): Promise<MentionScan> {
  const outcomes = await mapLimited(tasks, concurrency, (task) => checkTask(api, task.id, userId))
  const succeeded = outcomes.filter((o): o is Extract<Outcome, { isMentioned: boolean }> => 'isMentioned' in o)
  return {
    mentioned: new Set(succeeded.filter((o) => o.isMentioned).map((o) => o.taskId)),
    checked: new Set(succeeded.map((o) => o.taskId)),
    failed: outcomes.length - succeeded.length,
  }
}
