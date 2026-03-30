# Repository Guidelines

## Project Structure & Module Organization
This repository is a Bun-first cookie test harness for validating cross-port auth and cookie forwarding. Treat Bun as the default runtime, package manager, and build tool for all local work. Core entrypoints live at the repo root:

- `server-3000.ts`: mock auth server that issues and validates the session cookie.
- `server-3001.ts`: app server that renders `/login`, checks auth on `/dashboard`, and exposes debug routes.
- `dev.ts`: starts both Bun servers for local development.
- `run-test.ts`: browser-driven test harness using `agent-browser`.

CI is defined in `.github/workflows/cookie-test.yml`. Generated test artifacts are written under `evidence/auth/` and may include screenshots, HAR files, saved state, and `recording.webm`.

## Build, Test, and Development Commands
- `bun install`: install Bun dependencies from `bun.lock`.
- `bun run dev`: start both local servers on ports `3000` and `3001`.
- `bun run test`: execute the end-to-end browser harness in `run-test.ts`.
- `bun build server-3000.ts server-3001.ts --outdir /tmp/cookie-test-build`: quick compile check for both servers.
- `bun build run-test.ts --outfile /tmp/run-test.js`: compile-check the browser harness.

Use Bun commands instead of `node`, `npm`, or `npx` unless a workflow explicitly requires otherwise. Set overrides inline when needed, for example: `AUTH_PORT=3100 APP_PORT=3101 bun run dev`.

## Coding Style & Naming Conventions
Use TypeScript with Bun-native APIs such as `Bun.env`, `Bun.file`, and `Bun.spawnSync`. Prefer Bun primitives over Node modules and avoid adding `node:*` dependencies unless there is no Bun equivalent. Keep small top-level constants, straightforward control flow, and two-space indentation consistent with the existing files. Name server entrypoints by port (`server-3000.ts`) and keep helper functions descriptive, for example `parseCookieHeader` or `waitForFile`.

No dedicated formatter or linter is configured today, so keep edits minimal and stylistically consistent with the surrounding file.

## Testing Guidelines
The main test path is the `agent-browser` harness in `run-test.ts`. Keep test outputs deterministic and save debugging artifacts into `evidence/auth/`. When changing auth or cookie behavior, verify both the browser-visible flow and the server-side cookie/session logs.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects such as `Add Bun-based cookie test harness updates` and `Refactor agent browser binary resolution and enhance main function error handling`. Follow that pattern.

PRs should summarize the behavior change, mention port or env var changes, and include relevant evidence when debugging browser behavior, especially screenshots, HAR output, or notes from `recording.webm`.
