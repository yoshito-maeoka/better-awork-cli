import { userName, type Comment, type User } from '../api/schemas.js'
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

const COMMENT_INDENT = '  '

/** Flatten description and comments into pre-wrapped rows for the scrollable body. */
export function buildDetailLines(description: string | null | undefined, comments: readonly AuthoredComment[], width: number): Line[] {
  const text = htmlToText(description)
  const descriptionLines: Line[] = text
    ? wrapLines(text, width).map((t) => ({ text: t }))
    : [{ text: 'No description.', dim: true }]

  const header: Line = { text: `── Comments (${comments.length}) ──`, bold: true, color: 'cyan' }
  const commentLines = comments.flatMap(({ comment, author }): Line[] => [
    { text: `${userName(author ?? undefined)} · ${formatDateTime(comment.createdOn)}`, color: 'yellow' },
    ...wrapLines(htmlToText(comment.message), width - COMMENT_INDENT.length).map((t) => ({ text: COMMENT_INDENT + t })),
    { text: '' },
  ])
  const empty: Line[] = comments.length === 0 ? [{ text: 'No comments yet. Press c to add one.', dim: true }] : []

  return [...descriptionLines, { text: '' }, header, ...empty, ...commentLines]
}

export const byCreatedOn = (a: AuthoredComment, b: AuthoredComment): number =>
  (a.comment.createdOn ?? '').localeCompare(b.comment.createdOn ?? '')
