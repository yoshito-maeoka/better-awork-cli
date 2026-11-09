import { userName, type ChecklistItem, type Comment, type User } from '../api/schemas.js'
import { formatDateTime } from '../text/format.js'
import { htmlToText } from '../text/html.js'
import { wrapLines } from '../text/wrap.js'

export interface Line {
  text: string
  color?: string
  bold?: boolean
  dim?: boolean
}

export interface AuthoredComment {
  comment: Comment
  author: User | null
}

export interface DetailContent {
  description: string | null | undefined
  checklist: readonly ChecklistItem[]
  comments: readonly AuthoredComment[]
}

const COMMENT_INDENT = '  '
const CHECKBOX_DONE = '[x] '
const CHECKBOX_OPEN = '[ ] '

/** awork stores references in comment HTML as `~[<kind>Id:<uuid>]`. */
const REFERENCE = /~\[(\w+?)Id:([^\]]+)\]/gi
const REFERENCE_PLACEHOLDERS: Record<string, string> = { file: '[file]', team: '@team' }

/** Comment HTML with mentions and other references shown as readable names. */
export function commentHtml(comment: Comment): string {
  if (comment.plainFormattedMessage) return comment.plainFormattedMessage
  const mentioned = new Map((comment.mentions?.users ?? []).map((u) => [u.id.toLowerCase(), u]))
  return (comment.message ?? '').replace(REFERENCE, (_, kind: string, id: string) => {
    if (kind.toLowerCase() !== 'user') return REFERENCE_PLACEHOLDERS[kind.toLowerCase()] ?? `[${kind}]`
    const user = mentioned.get(id.toLowerCase())
    return user ? `@${userName(user)}` : '@someone'
  })
}

const sectionHeader = (title: string): Line => ({ text: `── ${title} ──`, bold: true, color: 'cyan' })

const byOrder = (a: ChecklistItem, b: ChecklistItem): number => (a.order ?? 0) - (b.order ?? 0)

function checklistLines(items: readonly ChecklistItem[], width: number): Line[] {
  if (items.length === 0) return []
  const done = items.filter((i) => i.isDone).length
  const rows = [...items].sort(byOrder).flatMap((item): Line[] => {
    const box = item.isDone ? CHECKBOX_DONE : CHECKBOX_OPEN
    const pad = ' '.repeat(box.length)
    return wrapLines(item.name, width - box.length).map((t, i) => ({
      text: (i === 0 ? box : pad) + t,
      dim: item.isDone,
    }))
  })
  return [sectionHeader(`Checklist (${done}/${items.length})`), ...rows, { text: '' }]
}

function commentLines(comments: readonly AuthoredComment[], width: number): Line[] {
  const header = sectionHeader(`Comments (${comments.length})`)
  if (comments.length === 0) return [header, { text: 'No comments yet. Press c to add one.', dim: true }]
  return [
    header,
    ...comments.flatMap(({ comment, author }): Line[] => [
      { text: `${userName(author ?? undefined)} · ${formatDateTime(comment.createdOn)}`, color: 'yellow' },
      ...wrapLines(htmlToText(commentHtml(comment)), width - COMMENT_INDENT.length).map((t) => ({ text: COMMENT_INDENT + t })),
      { text: '' },
    ]),
  ]
}

/** Flatten description, checklist and comments into pre-wrapped rows for the scrollable body. */
export function buildDetailLines({ description, checklist, comments }: DetailContent, width: number): Line[] {
  const text = htmlToText(description)
  const descriptionLines: Line[] = text
    ? wrapLines(text, width).map((t) => ({ text: t }))
    : [{ text: 'No description.', dim: true }]

  return [...descriptionLines, { text: '' }, ...checklistLines(checklist, width), ...commentLines(comments, width)]
}

export const byCreatedOn = (a: AuthoredComment, b: AuthoredComment): number =>
  (a.comment.createdOn ?? '').localeCompare(b.comment.createdOn ?? '')
