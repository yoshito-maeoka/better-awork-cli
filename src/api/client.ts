import type { z } from 'zod'

export const BASE_URL = 'https://api.awork.com/api/v1'
const MAX_ATTEMPTS = 4
const BACKOFF_BASE_MS = 500
const MAX_BACKOFF_MS = 10_000
const DEFAULT_PAGE_SIZE = 100
const MAX_PAGES = 50

export class AworkError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'AworkError'
  }
}

export interface ClientOptions {
  token: string
  baseUrl?: string
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

export interface Client {
  get<T>(path: string, schema: z.ZodType<T>): Promise<T>
  post(path: string, body: unknown): Promise<unknown>
  paged<T>(path: string, itemSchema: z.ZodType<T>, pageSize?: number): Promise<T[]>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const isRetryable = (status: number) => status === 429 || status >= 500

const retryDelay = (res: Response, attempt: number): number => {
  const header = Number(res.headers.get('retry-after'))
  const ms = Number.isFinite(header) && header > 0 ? header * 1000 : BACKOFF_BASE_MS * 2 ** attempt
  return Math.min(ms, MAX_BACKOFF_MS)
}

const describeFailure = (status: number, path: string): string => {
  if (status === 401) {
    return 'awork rejected the token (401). Use an API key (Settings → Integrations → your client → API keys), not the client ID/secret, then run `baw login` again.'
  }
  if (status === 403) return `No permission for ${path} (403).`
  if (status === 404) return `Not found: ${path} (404).`
  return `awork request failed: ${status} ${path}`
}

const parseBody = async (res: Response): Promise<unknown> => {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new AworkError(`awork returned a non-JSON response (${res.status}).`, res.status)
  }
}

export function createClient(options: ClientOptions): Client {
  const baseUrl = options.baseUrl ?? BASE_URL
  const doFetch = options.fetch ?? fetch
  const sleep = options.sleep ?? defaultSleep

  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const res = await doFetch(baseUrl + path, init)
      if (res.ok) return parseBody(res)
      if (isRetryable(res.status) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelay(res, attempt))
        continue
      }
      throw new AworkError(describeFailure(res.status, path), res.status)
    }
    throw new AworkError(`awork request failed after retries: ${path}`)
  }

  const validate = <T>(schema: z.ZodType<T>, data: unknown, path: string): T => {
    const result = schema.safeParse(data)
    if (!result.success) throw new AworkError(`Unexpected response from ${path}: ${result.error.message}`)
    return result.data
  }

  return {
    get: async (path, schema) => validate(schema, await request('GET', path), path),
    post: (path, body) => request('POST', path, body),
    paged: async (path, itemSchema, pageSize = DEFAULT_PAGE_SIZE) => {
      const sep = path.includes('?') ? '&' : '?'
      const pages: unknown[][] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const pagePath = `${path}${sep}pageSize=${pageSize}&page=${page}`
        const chunk = await request('GET', pagePath)
        if (!Array.isArray(chunk) || chunk.length === 0) break
        pages.push(chunk)
        if (chunk.length < pageSize) break
      }
      return pages.flat().map((item) => validate(itemSchema, item, path))
    },
  }
}
