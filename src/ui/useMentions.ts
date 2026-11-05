import { useCallback, useEffect, useState } from 'react'
import type { AworkApi } from '../api/awork.js'
import type { Task } from '../api/schemas.js'
import { findMentionedTaskIds } from '../tasks/mentions.js'

interface MentionState {
  mentioned: ReadonlySet<string>
  checked: ReadonlySet<string>
  failed: number
}

export interface Mentions {
  mentionedIds: ReadonlySet<string>
  isScanning: boolean
  /** Problem to show the user, if some comments could not be read. */
  warning?: string
  /** Forget cached results, e.g. after reloading tasks. */
  reset: () => void
}

const EMPTY: MentionState = { mentioned: new Set(), checked: new Set(), failed: 0 }

const union = (a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> => new Set([...a, ...b])

/**
 * Finds tasks whose comments mention `meId`. awork has no server-side filter for this,
 * so comments are fetched per task — only while enabled, and only for tasks not yet checked.
 */
export function useMentions(api: AworkApi, candidates: readonly Task[], meId: string, isEnabled: boolean): Mentions {
  const [state, setState] = useState<MentionState>(EMPTY)
  const [isScanning, setScanning] = useState(false)

  const pending = isEnabled ? candidates.filter((t) => !state.checked.has(t.id)) : []
  const pendingKey = pending.map((t) => t.id).join(',')

  useEffect(() => {
    if (!pendingKey) return
    let isCancelled = false
    setScanning(true)
    void findMentionedTaskIds(api, pending, meId).then((scan) => {
      if (isCancelled) return
      setState((current) => ({
        mentioned: union(current.mentioned, scan.mentioned),
        checked: union(current.checked, scan.checked),
        failed: scan.failed,
      }))
      setScanning(false)
    })
    return () => {
      isCancelled = true
      setScanning(false)
    }
    // `pendingKey` captures the identity of `pending`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, meId, pendingKey])

  const reset = useCallback(() => setState(EMPTY), [])
  const warning = state.failed > 0 ? `Could not read comments of ${state.failed} task(s); press r to retry.` : undefined

  return { mentionedIds: state.mentioned, isScanning, warning, reset }
}
