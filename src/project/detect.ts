import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'

export const LINK_FILE = '.baw.json'
const MIN_MATCH_LENGTH = 3

const LinkSchema = z.object({ projectId: z.string().min(1), projectName: z.string().optional() })
export type ProjectLink = z.infer<typeof LinkSchema>

interface Named {
  id: string
  name: string
}

/** Walk up from `start` and return the first directory for which `predicate` holds. */
const findUp = (start: string, predicate: (dir: string) => boolean): string | null => {
  let dir = start
  while (true) {
    if (predicate(dir)) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function findLink(cwd: string): { dir: string; link: ProjectLink } | null {
  const dir = findUp(cwd, (d) => existsSync(join(d, LINK_FILE)))
  if (!dir) return null
  const path = join(dir, LINK_FILE)
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(`Invalid ${LINK_FILE} at ${path}: ${(err as Error).message}`)
  }
  const parsed = LinkSchema.safeParse(raw)
  if (!parsed.success) throw new Error(`Invalid ${LINK_FILE} at ${path}: expected { "projectId": "..." }`)
  return { dir, link: parsed.data }
}

export function writeLink(dir: string, link: ProjectLink): string {
  const path = join(dir, LINK_FILE)
  writeFileSync(path, `${JSON.stringify(link, null, 2)}\n`)
  return path
}

export const findGitRoot = (cwd: string): string | null => findUp(cwd, (d) => existsSync(join(d, '.git')))

/** Names to try against awork project names, most specific signal first. */
export function candidateNames(cwd: string): string[] {
  const gitRoot = findGitRoot(cwd)
  const names = [gitRoot ? basename(gitRoot) : null, basename(cwd)].filter((n): n is string => Boolean(n))
  return [...new Set(names)]
}

export const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export function matchProjects<P extends Named>(projects: readonly P[], names: readonly string[]): P[] {
  for (const name of names) {
    const needle = normalize(name)
    if (needle.length < MIN_MATCH_LENGTH) continue
    const exact = projects.filter((p) => normalize(p.name) === needle)
    if (exact.length > 0) return exact
    const partial = projects.filter((p) => {
      const hay = normalize(p.name)
      return hay.length >= MIN_MATCH_LENGTH && (hay.includes(needle) || needle.includes(hay))
    })
    if (partial.length > 0) return partial
  }
  return []
}
