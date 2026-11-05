import { describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import { AworkError, createClient } from '../src/api/client.js'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

const setup = (...responses: Response[]) => {
  const fetchMock = vi.fn<typeof fetch>()
  responses.forEach((r) => fetchMock.mockResolvedValueOnce(r))
  const client = createClient({ token: 'tok', fetch: fetchMock, sleep: async () => {} })
  return { client, fetchMock }
}

describe('createClient', () => {
  test('sends bearer auth and validates the response', async () => {
    const { client, fetchMock } = setup(json(200, { id: 'u1' }))
    const result = await client.get('/me', z.object({ id: z.string() }))
    expect(result).toEqual({ id: 'u1' })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.awork.com/api/v1/me')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  test('retries on 429 and 5xx', async () => {
    const { client, fetchMock } = setup(json(429, {}), json(503, {}), json(200, { id: 'u1' }))
    await client.get('/me', z.object({ id: z.string() }))
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('throws AworkError with a helpful message on 401', async () => {
    const { client } = setup(json(401, { message: 'nope' }))
    await expect(client.get('/me', z.any())).rejects.toThrow(AworkError)
  })

  test('throws when the response does not match the schema', async () => {
    const { client } = setup(json(200, { wrong: true }))
    await expect(client.get('/me', z.object({ id: z.string() }))).rejects.toThrow(/Unexpected response/)
  })

  test('posts json bodies', async () => {
    const { client, fetchMock } = setup(new Response(null, { status: 204 }))
    await client.post('/tasks/changestatuses', [{ taskId: 't', statusId: 's' }])
    const [, init] = fetchMock.mock.calls[0]!
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe('[{"taskId":"t","statusId":"s"}]')
  })

  test('paged keeps fetching until a short page', async () => {
    const page1 = Array.from({ length: 2 }, (_, i) => ({ id: `a${i}` }))
    const { client, fetchMock } = setup(json(200, page1), json(200, [{ id: 'b' }]))
    const items = await client.paged('/projects', z.object({ id: z.string() }), 2)
    expect(items.map((i) => i.id)).toEqual(['a0', 'a1', 'b'])
    expect(fetchMock.mock.calls[1]![0]).toBe('https://api.awork.com/api/v1/projects?pageSize=2&page=2')
  })
})
