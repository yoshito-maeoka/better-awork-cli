import { describe, expect, test, vi } from 'vitest'
import { createAworkApi } from '../src/api/awork.js'
import type { Client } from '../src/api/client.js'

const fakeClient = (responses: Record<string, unknown>) => {
  const client: Client = {
    get: vi.fn(async (path, schema) => schema.parse(responses[path])),
    post: vi.fn(async () => null),
    paged: vi.fn(async (path, schema) => (responses[path] as unknown[]).map((x) => schema.parse(x))),
  }
  return client
}

describe('createAworkApi', () => {
  test('changeStatus posts to the bulk change endpoint', async () => {
    const client = fakeClient({})
    await createAworkApi(client).changeStatus('t1', 's2')
    expect(client.post).toHaveBeenCalledWith('/tasks/changestatuses', [{ taskId: 't1', statusId: 's2' }])
  })

  test('addComment sends escaped html', async () => {
    const client = fakeClient({})
    await createAworkApi(client).addComment('t1', 'a < b')
    expect(client.post).toHaveBeenCalledWith('/tasks/t1/comments', { message: '<p>a &lt; b</p>' })
  })

  test('addComment rejects empty text', async () => {
    await expect(createAworkApi(fakeClient({})).addComment('t1', '   ')).rejects.toThrow(/empty/)
  })

  test('taskStatuses are sorted by order', async () => {
    const client = fakeClient({
      '/projects/p1/taskstatuses': [
        { id: 'b', name: 'Done', type: 'done', order: 2 },
        { id: 'a', name: 'Todo', type: 'todo', order: 1 },
      ],
    })
    const statuses = await createAworkApi(client).taskStatuses('p1')
    expect(statuses.map((s) => s.id)).toEqual(['a', 'b'])
  })

  test('user lookups are cached and failures resolve to null', async () => {
    const client = fakeClient({ '/users/u1': { id: 'u1', firstName: 'Ada' } })
    const api = createAworkApi(client)
    await api.user('u1')
    await api.user('u1')
    expect(client.get).toHaveBeenCalledTimes(1)
    expect(await api.user('missing')).toBeNull()
  })

  test('ids are url-encoded', async () => {
    const client = fakeClient({ '/tasks/a%2Fb/comments': [] })
    await createAworkApi(client).comments('a/b')
    expect(client.get).toHaveBeenCalledWith('/tasks/a%2Fb/comments', expect.anything())
  })
})
