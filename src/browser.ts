import { spawn as nodeSpawn } from 'node:child_process'

export type Spawn = typeof nodeSpawn

export interface OpenUrlOptions {
  platform?: NodeJS.Platform
  spawn?: Spawn
}

const WEB_PROTOCOLS = new Set(['http:', 'https:'])

/** The program and arguments that hand a URL to the system's default browser. */
export function browserCommand(url: string, platform: NodeJS.Platform): [string, string[]] {
  if (platform === 'darwin') return ['open', [url]]
  // rundll32 takes the URL as a plain argument, unlike `cmd /c start`, which re-parses it.
  if (platform === 'win32') return ['rundll32', ['url.dll,FileProtocolHandler', url]]
  return ['xdg-open', [url]]
}

/** Open an http(s) URL in the default browser without blocking or tying it to this process. */
export function openUrl(url: string, options: OpenUrlOptions = {}): Promise<void> {
  const { platform = process.platform, spawn = nodeSpawn } = options
  if (!WEB_PROTOCOLS.has(new URL(url).protocol)) {
    return Promise.reject(new Error(`Refusing to open a non-http(s) URL: ${url}`))
  }
  const [command, args] = browserCommand(url, platform)
  return new Promise((resolve, reject) => {
    // No shell: the URL is passed as a single argument and never interpreted.
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.once('error', (err) => reject(new Error(`Could not run ${command}: ${err.message}`)))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
