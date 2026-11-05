import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import type { AworkApi } from '../src/api/awork.js'
import { writeLink } from '../src/project/detect.js'
import { linkTarget, resolveProject } from '../src/project/resolve.js'

const projects = [
  { id: 'p1', name: 'Shop' },
  { id: 'p2', name: 'Shop Relaunch' },
  { id: 'p3', name: 'Old', projectStatus: { type: 'closed' } },
  { id: 'p4', name: 'Intranet' },
]

const fakeApi = () =>
  ({
    projects: vi.fn(async () => projects),
    project: vi.fn(async (id: string) => projects.find((p) => p.id === id)!),
  }) as unknown as AworkApi

const dir = (name: string) => {
  const d = join(mkdtempSync(join(tmpdir(), 'baw-r-')), name)
  mkdirSync(d)
  return d
}

describe('resolveProject', () => {
  test('uses the .baw.json link without listing projects', async () => {
    const cwd = dir('anything')
    writeLink(cwd, { projectId: 'p4', projectName: 'Intranet' })
    const api = fakeApi()
    expect(await resolveProject(api, { cwd })).toEqual({ kind: 'resolved', project: { id: 'p4', name: 'Intranet' }, source: 'link' })
    expect(api.projects).not.toHaveBeenCalled()
  })

  test('looks up the name when the link has none', async () => {
    const cwd = dir('x')
    writeLink(cwd, { projectId: 'p1' })
    expect(await resolveProject(fakeApi(), { cwd })).toMatchObject({ project: { id: 'p1', name: 'Shop' } })
  })

  test('auto-detects a single match from the directory name', async () => {
    expect(await resolveProject(fakeApi(), { cwd: dir('intranet') })).toEqual({
      kind: 'resolved',
      project: { id: 'p4', name: 'Intranet' },
      source: 'detected',
    })
  })

  test('asks to pick when several projects match, with suggestions first', async () => {
    const result = await resolveProject(fakeApi(), { cwd: dir('sho') })
    if (result.kind !== 'pick') throw new Error('expected pick')
    expect(result.suggestions.map((p) => p.id)).toEqual(['p1', 'p2'])
  })

  test('hides closed projects from the picker', async () => {
    const result = await resolveProject(fakeApi(), { cwd: dir('zzz') })
    if (result.kind !== 'pick') throw new Error('expected pick')
    expect(result.projects.map((p) => p.id)).toEqual(['p1', 'p2', 'p4'])
  })

  test('forcePick ignores links and detection', async () => {
    const cwd = dir('intranet')
    writeLink(cwd, { projectId: 'p4' })
    expect((await resolveProject(fakeApi(), { cwd, forcePick: true })).kind).toBe('pick')
  })

  test('override matches by id or name', async () => {
    const cwd = dir('x')
    expect(await resolveProject(fakeApi(), { cwd, override: 'p2' })).toMatchObject({ project: { id: 'p2' }, source: 'flag' })
    expect(await resolveProject(fakeApi(), { cwd, override: 'shop' })).toMatchObject({ project: { id: 'p1' } })
  })

  test('override that matches nothing throws', async () => {
    await expect(resolveProject(fakeApi(), { cwd: dir('x'), override: 'nope' })).rejects.toThrow(/No awork project matches "nope"/)
  })
})

describe('linkTarget', () => {
  test('prefers the git root over cwd', () => {
    const root = dir('repo')
    mkdirSync(join(root, '.git'))
    const sub = join(root, 'pkg')
    mkdirSync(sub)
    expect(linkTarget(sub)).toBe(root)
    expect(linkTarget(dir('plain'))).toMatch(/plain$/)
  })
})
