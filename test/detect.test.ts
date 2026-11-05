import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { candidateNames, findGitRoot, findLink, LINK_FILE, matchProjects, normalize, writeLink } from '../src/project/detect.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'baw-'))

describe('normalize', () => {
  test('lowercases and strips non-alphanumerics', () => {
    expect(normalize('DB Autohaus – Strapi/Nuxt')).toBe('dbautohausstrapinuxt')
  })
})

describe('findLink', () => {
  test('finds a link file in a parent directory', () => {
    const root = tmp()
    writeFileSync(join(root, LINK_FILE), JSON.stringify({ projectId: 'p1', projectName: 'Shop' }))
    const nested = join(root, 'a', 'b')
    mkdirSync(nested, { recursive: true })
    expect(findLink(nested)).toEqual({ dir: root, link: { projectId: 'p1', projectName: 'Shop' } })
  })

  test('returns null when no link file exists', () => {
    expect(findLink(tmp())).toBeNull()
  })

  test('throws a clear error for an invalid link file', () => {
    const root = tmp()
    writeFileSync(join(root, LINK_FILE), '{"nope": true}')
    expect(() => findLink(root)).toThrow(/Invalid .baw.json/)
  })
})

describe('writeLink', () => {
  test('writes a link that findLink can read back', () => {
    const root = tmp()
    writeLink(root, { projectId: 'p2', projectName: 'Web' })
    expect(JSON.parse(readFileSync(join(root, LINK_FILE), 'utf8'))).toEqual({ projectId: 'p2', projectName: 'Web' })
  })
})

describe('findGitRoot / candidateNames', () => {
  test('uses git root name first, then the current directory name', () => {
    const root = join(tmp(), 'my-shop')
    mkdirSync(join(root, '.git'), { recursive: true })
    const sub = join(root, 'nuxt')
    mkdirSync(sub)
    expect(findGitRoot(sub)).toBe(root)
    expect(candidateNames(sub)).toEqual(['my-shop', 'nuxt'])
  })

  test('deduplicates when cwd is the git root', () => {
    const root = join(tmp(), 'repo')
    mkdirSync(join(root, '.git'), { recursive: true })
    expect(candidateNames(root)).toEqual(['repo'])
  })
})

describe('matchProjects', () => {
  const projects = [
    { id: '1', name: 'My Shop' },
    { id: '2', name: 'My Shop Relaunch' },
    { id: '3', name: 'Intranet' },
  ]

  test('prefers exact normalized matches', () => {
    expect(matchProjects(projects, ['my-shop']).map((p) => p.id)).toEqual(['1'])
  })

  test('falls back to partial matches', () => {
    expect(matchProjects(projects, ['relaunch']).map((p) => p.id)).toEqual(['2'])
  })

  test('ignores very short names to avoid noise', () => {
    expect(matchProjects(projects, ['my'])).toEqual([])
  })

  test('tries names in order and returns the first that matches', () => {
    expect(matchProjects(projects, ['unknown-thing', 'intranet']).map((p) => p.id)).toEqual(['3'])
  })
})
