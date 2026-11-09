import { render } from 'ink-testing-library'
import { describe, expect, test, vi } from 'vitest'
import type { AworkApi } from '../src/api/awork.js'
import type { Task, TaskStatus } from '../src/api/schemas.js'
import { DEFAULT_FILTER } from '../src/tasks/filter.js'
import { ProjectBoard } from '../src/ui/ProjectBoard.js'

const STATUSES: TaskStatus[] = [
  { id: 's-todo', name: 'To do', type: 'todo', order: 1 },
  { id: 's-prog', name: 'In progress', type: 'progress', order: 2 },
  { id: 's-done', name: 'Done', type: 'done', order: 3 },
]
const [TODO, PROGRESS, DONE] = STATUSES as [TaskStatus, TaskStatus, TaskStatus]

const TASKS: Task[] = [
  { id: 't1', name: 'Fix login bug', taskStatus: TODO, assignees: [{ id: 'me', firstName: 'Yo' }], description: '<p>Steps to reproduce</p>' },
  { id: 't2', name: 'Someone else task', taskStatus: TODO, assignees: [{ id: 'other', firstName: 'Bob', lastName: 'Builder' }] },
  { id: 't3', name: 'Old finished thing', taskStatus: DONE, assignees: [{ id: 'me' }] },
]

const fakeApi = (): AworkApi => ({
  me: vi.fn(async () => ({ id: 'me' })),
  users: vi.fn(async () => []),
  projects: vi.fn(async () => []),
  project: vi.fn(async () => ({ id: 'p', name: 'Shop' })),
  projectTasks: vi.fn(async () => TASKS),
  task: vi.fn(async (id: string) => TASKS.find((t) => t.id === id)!),
  taskStatuses: vi.fn(async () => STATUSES),
  comments: vi.fn(async () => [{ id: 'c1', message: '<p>First!</p>', userId: 'u2', createdOn: '2026-11-01T10:00:00Z' }]),
  checklist: vi.fn(async () => [{ id: 'i1', name: 'Write tests', isDone: true, order: 1 }]),
  user: vi.fn(async () => ({ id: 'u2', firstName: 'Ada', lastName: 'Lovelace' })),
  changeStatus: vi.fn(async () => {}),
  addComment: vi.fn(async () => {}),
  taskUrl: vi.fn(async (id: string) => `https://acme.awork.com/tasks/${id}/details`),
})

const tick = () => new Promise((resolve) => setTimeout(resolve, 20))
const ENTER = '\r'
const DOWN = '\u001B[B'

const setup = async () => {
  const api = fakeApi()
  const openUrl = vi.fn(async () => {})
  const ui = render(
    <ProjectBoard api={api} meId="me" project={{ id: 'p', name: 'Shop' }} initialFilter={DEFAULT_FILTER} openUrl={openUrl} />,
  )
  await tick()
  return { api, ui, openUrl }
}

const openStatusPickerAndMoveDown = async (ui: Awaited<ReturnType<typeof setup>>['ui']) => {
  ui.stdin.write(ENTER)
  await tick()
  ui.stdin.write('s')
  await tick()
  ui.stdin.write(DOWN)
  await tick()
}

describe('ProjectBoard', () => {
  test('lists only my open tasks by default', async () => {
    const { ui } = await setup()
    const frame = ui.lastFrame() ?? ''
    expect(frame).toContain('Fix login bug')
    expect(frame).not.toContain('Someone else task')
    expect(frame).not.toContain('Old finished thing')
    expect(frame).toContain('assigned to me · open')
  })

  test('a and d toggle everyone and done tasks', async () => {
    const { ui } = await setup()
    ui.stdin.write('a')
    await tick()
    expect(ui.lastFrame()).toContain('Someone else task')
    ui.stdin.write('d')
    await tick()
    expect(ui.lastFrame()).toContain('Old finished thing')
  })

  test('m shows tasks where a comment mentions me', async () => {
    const { api, ui } = await setup()
    vi.mocked(api.comments).mockImplementation(async (id: string) =>
      id === 't2' ? [{ id: 'c9', message: '<p>~[userId:me] can you look?</p>', userId: 'u2' }] : [],
    )
    ui.stdin.write('m')
    await tick()
    const frame = ui.lastFrame() ?? ''
    expect(frame).toContain('mentioning me')
    expect(frame).toContain('Someone else task')
    expect(frame).not.toContain('Fix login bug')
    expect(api.comments).not.toHaveBeenCalledWith('t3')
  })

  test('shows who is assigned to each task', async () => {
    const { ui } = await setup()
    ui.stdin.write('a')
    await tick()
    const frame = ui.lastFrame() ?? ''
    expect(frame).toContain('Bob Builder')
    expect(frame).toMatch(/Fix login bug\s+Yo\s/)
  })

  test('w opens the highlighted task in the browser', async () => {
    const { ui, openUrl } = await setup()
    ui.stdin.write('w')
    await tick()
    expect(openUrl).toHaveBeenCalledWith('https://acme.awork.com/tasks/t1/details')
    expect(ui.lastFrame()).toContain('Opened in browser')
  })

  test('w in the detail view opens that task and reports failures', async () => {
    const { ui, openUrl } = await setup()
    openUrl.mockRejectedValueOnce(new Error('xdg-open not found'))
    ui.stdin.write(ENTER)
    await tick()
    ui.stdin.write('w')
    await tick()
    expect(openUrl).toHaveBeenCalledWith('https://acme.awork.com/tasks/t1/details')
    expect(ui.lastFrame()).toContain('xdg-open not found')
  })

  test('enter opens the task with description and comments', async () => {
    const { ui } = await setup()
    ui.stdin.write(ENTER)
    await tick()
    const frame = ui.lastFrame() ?? ''
    expect(frame).toContain('Steps to reproduce')
    expect(frame).toContain('Ada Lovelace')
    expect(frame).toContain('First!')
    expect(frame).toContain('[x] Write tests')
  })

  test('s changes the status from the detail view', async () => {
    const { api, ui } = await setup()
    await openStatusPickerAndMoveDown(ui)
    expect(ui.lastFrame()).toContain('Change status')
    ui.stdin.write(ENTER)
    await tick()
    expect(api.changeStatus).toHaveBeenCalledWith('t1', PROGRESS.id)
    expect(ui.lastFrame()).toContain('Status changed to In progress.')
  })

  test('c posts a comment from the detail view', async () => {
    const { api, ui } = await setup()
    ui.stdin.write(ENTER)
    await tick()
    ui.stdin.write('c')
    await tick()
    ui.stdin.write('Looks good')
    await tick()
    ui.stdin.write(ENTER)
    await tick()
    expect(api.addComment).toHaveBeenCalledWith('t1', 'Looks good')
    expect(ui.lastFrame()).toContain('Comment posted.')
  })

  test('shows API errors instead of crashing', async () => {
    const { api, ui } = await setup()
    vi.mocked(api.changeStatus).mockRejectedValueOnce(new Error('No permission'))
    await openStatusPickerAndMoveDown(ui)
    ui.stdin.write(ENTER)
    await tick()
    expect(ui.lastFrame()).toContain('No permission')
  })
})
