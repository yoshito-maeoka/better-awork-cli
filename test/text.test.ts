import { describe, expect, test } from 'vitest'
import { fitText, formatAssignees, formatDate, isOverdue } from '../src/text/format.js'
import { wrapLines } from '../src/text/wrap.js'

describe('wrapLines', () => {
  test('keeps short lines and preserves blank lines', () => {
    expect(wrapLines('a\n\nb', 10)).toEqual(['a', '', 'b'])
  })

  test('wraps at word boundaries', () => {
    expect(wrapLines('one two three four', 9)).toEqual(['one two', 'three', 'four'])
  })

  test('hard-breaks words longer than the width', () => {
    expect(wrapLines('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })
})

describe('formatDate / isOverdue', () => {
  test('formats ISO dates as YYYY-MM-DD and handles missing values', () => {
    expect(formatDate('2026-11-05T10:00:00Z')).toBe('2026-11-05')
    expect(formatDate(null)).toBe('')
  })

  test('detects overdue dates relative to now', () => {
    const now = new Date('2026-11-05T12:00:00Z')
    expect(isOverdue('2026-11-04T00:00:00Z', now)).toBe(true)
    expect(isOverdue('2026-11-06T00:00:00Z', now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
  })
})

describe('fitText', () => {
  test('pads short text to the width', () => {
    expect(fitText('abc', 6)).toBe('abc   ')
  })

  test('truncates long text with an ellipsis', () => {
    expect(fitText('abcdefgh', 5)).toBe('abcd…')
  })
})

describe('formatAssignees', () => {
  const ada = { id: 'u1', firstName: 'Ada', lastName: 'Lovelace' }
  const bob = { id: 'u2', firstName: 'Bob', lastName: 'Builder' }

  test('shows the full name of a single assignee', () => {
    expect(formatAssignees([ada])).toBe('Ada Lovelace')
  })

  test('shows the first assignee and how many more there are', () => {
    expect(formatAssignees([ada, bob, { id: 'u3' }])).toBe('Ada Lovelace +2')
  })

  test('shows a dash when nobody is assigned', () => {
    expect(formatAssignees([])).toBe('—')
    expect(formatAssignees(null)).toBe('—')
  })
})
