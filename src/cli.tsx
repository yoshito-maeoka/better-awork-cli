#!/usr/bin/env node
import { render } from 'ink'
import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { createAworkApi, type AworkApi } from './api/awork.js'
import { createClient } from './api/client.js'
import { userName, type User } from './api/schemas.js'
import { resolveToken, resolveUserId, saveConfig } from './config.js'
import { findUser, isApiClient } from './identity.js'
import { DEFAULT_FILTER } from './tasks/filter.js'
import { App } from './ui/App.js'

const VERSION = '0.1.0'

const HELP = `baw — a better awork CLI for tickets

Usage
  baw                     List open tasks assigned to you in this directory's project
  baw link                Pick the awork project for this directory (writes .baw.json)
  baw login [token]       Save your awork API key (and who you are) to ~/.config/baw/config.json
  baw whoami              Show which awork user baw treats as "me"

Options
  -a, --all               Show tasks of everyone, not just yours
  -d, --done              Include done tasks
  -p, --project <name|id> Use this project instead of detecting it
  -u, --user <email|name> With login: your awork user (skips the question)
  -h, --help              Show help
  -v, --version           Show version

Token lookup order: $BAW_TOKEN, $AWORK_TOKEN, ~/.config/baw/config.json, ~/.config/awork-cli/config.json
User: $BAW_USER_ID or userId in ~/.config/baw/config.json (set by baw login)

Keys
  list    ↑↓/jk move · enter open · / search · a mine/everyone · d done · r refresh · q quit
  task    s change status · c comment · ↑↓ scroll · r reload · esc back
`

interface TuiOptions {
  all: boolean
  done: boolean
  project?: string
  forcePick: boolean
}

const fail = (text: string): never => {
  process.stderr.write(`baw: ${text}\n`)
  process.exit(1)
}

const ask = async (question: string): Promise<string> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

const TOKEN_QUESTION =
  'awork API key (Settings → Integrations → your client → API keys → Create API key; not the client secret): '

const gitEmail = (): string => {
  try {
    return execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

/** API keys log in as the integration, so ask which workspace user the person is. */
async function pickHumanUser(api: AworkApi, userArg?: string): Promise<User> {
  const users = await api.users()
  const fallback = gitEmail()
  const query =
    userArg ?? ((await ask(`Your awork email or name${fallback ? ` [${fallback}]` : ''}: `)) || fallback)
  const match = findUser(users, query)
  if (match.kind === 'found') return match.user
  if (match.kind === 'ambiguous') {
    return fail(`"${query}" matches ${match.users.map((u) => userName(u)).join(', ')}. Be more specific.`)
  }
  return fail(`No awork user matches "${query}". Try your full name or the email you log in to awork with.`)
}

async function login(tokenArg?: string, userArg?: string): Promise<void> {
  // `baw login --user X` only (re)sets the user and keeps the saved key.
  const saved = userArg && !tokenArg ? resolveToken()?.token : undefined
  const token = (tokenArg ?? saved ?? (await ask(TOKEN_QUESTION))).trim()
  if (!token) fail('token is empty.')
  // Verify before saving so a typo never ends up in the config.
  const api = createAworkApi(createClient({ token }))
  const me = await api.me()
  const human = isApiClient(me) || userArg ? await pickHumanUser(api, userArg) : me
  const path = saveConfig({ token, userId: human.id })
  process.stdout.write(`Logged in as ${userName(human)}. Saved to ${path}\n`)
}

/** The user whose tasks count as "mine": configured user first, then the token's own user. */
async function resolveMeId(api: AworkApi): Promise<string> {
  const configured = resolveUserId()
  if (configured) return configured
  const me = await api.me()
  if (isApiClient(me)) {
    return fail('this API key acts as the integration, not as you. Run `baw login` again to choose your awork user.')
  }
  return me.id
}

async function whoami(): Promise<void> {
  const resolved = resolveToken() ?? fail('no awork token found. Run `baw login` or set BAW_TOKEN.')
  const api = createAworkApi(createClient({ token: resolved.token }))
  const meId = await resolveMeId(api)
  const user = (await api.user(meId)) ?? fail(`configured user ${meId} was not found in awork.`)
  process.stdout.write(`${userName(user)} (${meId}) · token from ${resolved.source}\n`)
}

async function runTui(options: TuiOptions): Promise<void> {
  if (!process.stdin.isTTY) fail('needs an interactive terminal.')
  const resolved = resolveToken() ?? fail('no awork token found. Run `baw login` or set BAW_TOKEN.')
  const api = createAworkApi(createClient({ token: resolved.token }))
  const meId = await resolveMeId(api)
  let fatal: string | undefined
  const instance = render(
    <App
      api={api}
      meId={meId}
      cwd={process.cwd()}
      filter={{ ...DEFAULT_FILTER, mineOnly: !options.all, includeDone: options.done }}
      projectOverride={options.project}
      forcePick={options.forcePick}
      onFatal={(text) => {
        fatal = text
      }}
    />,
  )
  await instance.waitUntilExit()
  if (fatal) fail(fatal)
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: 'boolean', short: 'a', default: false },
      done: { type: 'boolean', short: 'd', default: false },
      project: { type: 'string', short: 'p' },
      user: { type: 'string', short: 'u' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
  })
  if (values.help) return void process.stdout.write(HELP)
  if (values.version) return void process.stdout.write(`${VERSION}\n`)

  const [command, ...rest] = positionals
  const tuiOptions = { all: values.all, done: values.done, project: values.project }
  switch (command) {
    case undefined:
    case 'ls':
    case 'list':
      return runTui({ ...tuiOptions, forcePick: false })
    case 'link':
      return runTui({ ...tuiOptions, forcePick: true })
    case 'login':
      return login(rest[0], values.user)
    case 'whoami':
      return whoami()
    default:
      fail(`unknown command "${command}". See \`baw --help\`.`)
  }
}

main().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)))
