import { describe, expect, test } from 'vitest'
import { htmlToText, textToHtml } from '../src/text/html.js'

describe('htmlToText', () => {
  test('returns empty string for null or undefined', () => {
    expect(htmlToText(null)).toBe('')
    expect(htmlToText(undefined)).toBe('')
  })

  test('turns paragraphs and breaks into newlines and strips tags', () => {
    expect(htmlToText('<p>Hello <b>world</b></p><p>Line<br/>two</p>')).toBe('Hello world\nLine\ntwo')
  })

  test('renders list items as bullets', () => {
    expect(htmlToText('<ul><li>one</li><li>two</li></ul>')).toBe('• one\n• two')
  })

  test('decodes common entities', () => {
    expect(htmlToText('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;&nbsp;f')).toBe('a & b <c> "d" \'e\' f')
  })

  test('collapses runs of blank lines', () => {
    expect(htmlToText('<p>a</p><p></p><p></p><p>b</p>')).toBe('a\n\nb')
  })
})

describe('textToHtml', () => {
  test('escapes html and converts newlines to breaks', () => {
    expect(textToHtml('a < b & c\nnext')).toBe('<p>a &lt; b &amp; c<br>next</p>')
  })

  test('trims surrounding whitespace', () => {
    expect(textToHtml('  hi  ')).toBe('<p>hi</p>')
  })
})
