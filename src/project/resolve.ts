import type { AworkApi } from '../api/awork.js'
import type { Project } from '../api/schemas.js'
import { candidateNames, findGitRoot, findLink, matchProjects } from './detect.js'

export interface ProjectRef {
  id: string
  name: string
}

export type ProjectResolution =
  | { kind: 'resolved'; project: ProjectRef; source: 'link' | 'flag' | 'detected' }
  | { kind: 'pick'; projects: Project[]; suggestions: Project[] }

export interface ResolveOptions {
  cwd: string
  override?: string
  forcePick?: boolean
}

const toRef = (p: Project): ProjectRef => ({ id: p.id, name: p.name })
const isOpen = (p: Project) => p.projectStatus?.type !== 'closed'

const resolveOverride = (projects: Project[], override: string): Project => {
  const byId = projects.find((p) => p.id === override)
  if (byId) return byId
  const matches = matchProjects(projects, [override])
  const [first] = matches
  if (!first) throw new Error(`No awork project matches "${override}".`)
  if (matches.length > 1) {
    throw new Error(`"${override}" matches several projects: ${matches.map((p) => p.name).join(', ')}`)
  }
  return first
}

export async function resolveProject(api: AworkApi, options: ResolveOptions): Promise<ProjectResolution> {
  const { cwd, override, forcePick = false } = options

  if (override) {
    return { kind: 'resolved', project: toRef(resolveOverride(await api.projects(), override)), source: 'flag' }
  }

  if (!forcePick) {
    const found = findLink(cwd)
    if (found) {
      const { projectId, projectName } = found.link
      const name = projectName ?? (await api.project(projectId)).name
      return { kind: 'resolved', project: { id: projectId, name }, source: 'link' }
    }
  }

  const open = (await api.projects()).filter(isOpen)
  const suggestions = matchProjects(open, candidateNames(cwd))
  const [only] = suggestions
  if (!forcePick && only && suggestions.length === 1) {
    return { kind: 'resolved', project: toRef(only), source: 'detected' }
  }
  return { kind: 'pick', projects: open, suggestions }
}

/** Where `.baw.json` should live: the repository root if there is one. */
export const linkTarget = (cwd: string): string => findGitRoot(cwd) ?? cwd
