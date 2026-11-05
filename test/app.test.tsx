import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import { describe, expect, test, vi } from 'vitest'
import type { AworkApi } from '../src/api/awork.js'
import { DEFAULT_FILTER } from '../src/tasks/filter.js'
import { App } from '../src/ui/App.js'

const tick = () => new Promise((resolve) => setTimeout(resolve, 30))

const fakeApi = (overrides: Partial<AworkApi> = {}): AworkApi =>
  ({
    me: vi.fn(async () => ({ id: 'me' })),
    projects: vi.fn(async () => [
      { id: 'p1', name: 'Shop' },
      { id: 'p2', name: 'Intranet' },
    ]),
    project: vi.fn(),
    projectTasks: vi.fn(async () => []),
    taskStatuses: vi.fn(async () => []),
    ...overrides,
  }) as unknown as AworkApi

const repo = (name: string) => {
  const dir = join(mkdtempSync(join(tmpdir(), 'baw-app-')), name)
  mkdirSync(join(dir, '.git'), { recursive: true })
  return dir
}

describe('App', () => {
  test('opens the detected project directly', async () => {
    const ui = render(<App meId="me" api={fakeApi()} cwd={repo('intranet')} filter={DEFAULT_FILTER} onFatal={vi.fn()} />)
    await tick()
    expect(ui.lastFrame()).toContain('Intranet')
    expect(ui.lastFrame()).toContain('detected from directory name')
  })

  test('asks for the project when nothing matches and saves the choice', async () => {
    const cwd = repo('unrelated')
    const ui = render(<App meId="me" api={fakeApi()} cwd={cwd} filter={DEFAULT_FILTER} onFatal={vi.fn()} />)
    await tick()
    expect(ui.lastFrame()).toContain('Which awork project is this directory?')
    ui.stdin.write('shop')
    await tick()
    ui.stdin.write('\r')
    await tick()
    expect(JSON.parse(readFileSync(join(cwd, '.baw.json'), 'utf8'))).toEqual({ projectId: 'p1', projectName: 'Shop' })
    expect(ui.lastFrame()).toContain('Linked Shop')
  })

  test('reports boot failures through onFatal', async () => {
    const onFatal = vi.fn()
    const api = fakeApi({ projects: vi.fn(async () => Promise.reject(new Error('bad token'))) })
    render(<App meId="me" api={api} cwd={repo('x')} filter={DEFAULT_FILTER} onFatal={onFatal} />)
    await tick()
    expect(onFatal).toHaveBeenCalledWith('bad token')
  })
})
