import { EventEmitter } from 'node:events'
import { describe, expect, test, vi } from 'vitest'
import { browserCommand, openUrl, type Spawn } from '../src/browser.js'

const URL = 'https://acme.awork.com/tasks/t1/details'

/** A fake child process that emits `event` right after spawning. */
const fakeSpawn = (event: 'spawn' | 'error') =>
  vi.fn(() => {
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    setImmediate(() => child.emit(event, new Error('ENOENT')))
    return child
  }) as unknown as Spawn & ReturnType<typeof vi.fn>

describe('browserCommand', () => {
  test('uses open on macOS, xdg-open on Linux and rundll32 on Windows', () => {
    expect(browserCommand(URL, 'darwin')).toEqual(['open', [URL]])
    expect(browserCommand(URL, 'linux')).toEqual(['xdg-open', [URL]])
    expect(browserCommand(URL, 'win32')).toEqual(['rundll32', ['url.dll,FileProtocolHandler', URL]])
  })
})

describe('openUrl', () => {
  test('launches the browser detached without a shell', async () => {
    const spawn = fakeSpawn('spawn')
    await openUrl(URL, { platform: 'darwin', spawn })
    expect(spawn).toHaveBeenCalledWith('open', [URL], { detached: true, stdio: 'ignore' })
  })

  test('rejects when the opener cannot be started', async () => {
    await expect(openUrl(URL, { platform: 'linux', spawn: fakeSpawn('error') })).rejects.toThrow(/xdg-open/)
  })

  test('refuses anything but http(s) urls', async () => {
    const spawn = fakeSpawn('spawn')
    await expect(openUrl('file:///etc/passwd', { platform: 'darwin', spawn })).rejects.toThrow(/http/)
    expect(spawn).not.toHaveBeenCalled()
  })
})
