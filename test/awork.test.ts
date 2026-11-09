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

  test('checklist fetches the task checklist items', async () => {
    const client = fakeClient({ '/tasks/t1/checklistitems': [{ id: 'i1', name: 'Do it', isDone: false, order: 1 }] })
    expect(await createAworkApi(client).checklist('t1')).toEqual([{ id: 'i1', name: 'Do it', isDone: false, order: 1 }])
  })

  test('addComment rejects empty text', async () => {
    await expect(createAworkApi(fakeClient({})).addComment('t1', '   ')).rejects.toThrow(/empty/)
  })

  test('taskUrl builds the web link from the workspace url and caches /me', async () => {
    const client = fakeClient({ '/me': { id: 'u', workspace: { url: 'https://acme.awork.com/' } } })
    const api = createAworkApi(client)
    expect(await api.taskUrl('t 1')).toBe('https://acme.awork.com/tasks/t%201/details')
    await api.taskUrl('t2')
    expect(client.get).toHaveBeenCalledTimes(1)
  })

  test('taskUrl refuses a missing or non-https workspace url', async () => {
    await expect(createAworkApi(fakeClient({ '/me': { id: 'u' } })).taskUrl('t')).rejects.toThrow(/workspace/)
    const insecure = fakeClient({ '/me': { id: 'u', workspace: { url: 'javascript:alert(1)' } } })
    await expect(createAworkApi(insecure).taskUrl('t')).rejects.toThrow(/workspace/)
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
