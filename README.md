# baw — a better awork CLI

Ticket-focused terminal UI for [awork](https://www.awork.com). Run it inside a project directory and it shows
**your open tasks** for that directory's awork project.

```
npm install && npm run build && npm link   # installs `baw` and `bawc`
baw login                                  # paste an awork API token (verified, stored 0600)
cd ~/work/my-shop && baw
```

## How the project is detected

1. `--project <name|id>` flag
2. `.baw.json` in the current directory or any parent (`{ "projectId": "…", "projectName": "…" }`)
3. git-root / directory name fuzzy-matched against open awork project names (used when exactly one matches)
4. otherwise a searchable picker; your choice is saved to `.baw.json` at the git root

`baw link` always opens the picker to re-link a directory.

## Keys

| View | Keys |
|------|------|
| List | `↑↓`/`jk` move · `enter` open · `/` search · `a` mine ↔ everyone · `d` show/hide done · `r` refresh · `q` quit |
| Task | `s` change status · `c` comment · `↑↓`/`jk` scroll · `space`/`u` page · `r` reload · `esc` back |

## Token lookup

`$BAW_TOKEN` → `$AWORK_TOKEN` → `~/.config/baw/config.json` → `~/.config/awork-cli/config.json` (`ApiToken`).

## awork API endpoints used

`GET /me`, `GET /projects`, `GET /projects/{id}`, `GET /projects/{id}/projecttasks`, `GET /projects/{id}/taskstatuses`,
`GET /tasks/{id}`, `GET /tasks/{id}/comments`, `GET /users/{id}`, `POST /tasks/changestatuses`, `POST /tasks/{id}/comments`.

## Development

```
npm run dev        # run from source (tsx)
npm test           # vitest
npm run coverage
npm run typecheck
```
