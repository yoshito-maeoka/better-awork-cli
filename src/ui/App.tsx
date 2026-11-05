import { Text, useApp, useWindowSize } from 'ink'
import { useEffect, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import type { Project } from '../api/schemas.js'
import { writeLink } from '../project/detect.js'
import { linkTarget, resolveProject, type ProjectRef } from '../project/resolve.js'
import type { TaskFilter } from '../tasks/filter.js'
import { ProjectBoard } from './ProjectBoard.js'
import { ProjectPicker } from './ProjectPicker.js'

export interface AppProps {
  api: AworkApi
  meId: string
  cwd: string
  filter: TaskFilter
  projectOverride?: string
  forcePick?: boolean
  onFatal: (message: string) => void
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'pick'; projects: Project[]; suggestions: Project[] }
  | { kind: 'board'; project: ProjectRef; notice?: string }

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

const sourceNotice = (source: 'link' | 'flag' | 'detected'): string | undefined =>
  source === 'detected' ? 'Project detected from directory name. Run `baw link` to pin a different one.' : undefined

export function App({ api, meId, cwd, filter, projectOverride, forcePick, onFatal }: AppProps) {
  const { exit } = useApp()
  const { rows } = useWindowSize()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })

  useEffect(() => {
    let isCancelled = false
    const boot = async () => {
      const resolution = await resolveProject(api, { cwd, override: projectOverride, forcePick })
      if (isCancelled) return
      setPhase(
        resolution.kind === 'resolved'
          ? { kind: 'board', project: resolution.project, notice: sourceNotice(resolution.source) }
          : { kind: 'pick', projects: resolution.projects, suggestions: resolution.suggestions },
      )
    }
    boot().catch((err: unknown) => {
      if (isCancelled) return
      onFatal(message(err))
      exit()
    })
    return () => {
      isCancelled = true
    }
  }, [api, cwd, projectOverride, forcePick, onFatal, exit])

  if (phase.kind === 'loading') return <Text color="yellow">Connecting to awork…</Text>

  if (phase.kind === 'pick') {
    const pick = (project: Project) => {
      const ref = { id: project.id, name: project.name }
      let notice: string
      try {
        notice = `Linked ${project.name} → ${writeLink(linkTarget(cwd), { projectId: ref.id, projectName: ref.name })}`
      } catch (err) {
        notice = `Could not save .baw.json: ${message(err)}`
      }
      setPhase({ kind: 'board', project: ref, notice })
    }
    return (
      <ProjectPicker
        projects={phase.projects}
        suggestions={phase.suggestions}
        height={rows}
        onPick={pick}
        onCancel={exit}
      />
    )
  }

  return <ProjectBoard api={api} meId={meId} project={phase.project} initialFilter={filter} notice={phase.notice} />
}
