# Isolated Cross-Port Cookie Test

This repository is a small Bun-first harness for testing whether a browser session cookie set by one localhost port is forwarded and honored on another port.

It exists to isolate one question from a larger app stack: after signing in on `:3000`, does a request to `:3001` still carry the cookie, and can `:3001` forward it back to `:3000` for session validation?

## What It Contains

- `server-3000.ts`: mock auth server
  - `POST /sign-in` sets `test_session=abc123`
  - `GET /get-session` validates the cookie and returns `{ user }` or `{ user: null }`
- `server-3001.ts`: app server
  - `GET /login` serves a simple sign-in form
  - `GET /dashboard` simulates SSR auth by forwarding cookies to `:3000`
  - `GET /api/debug/cookies` shows the raw cookie header, parsed cookies, and the auth server response
- `run-test.ts`: `agent-browser` harness that signs in, verifies redirect behavior, clears cookies, and saves evidence
- `dev.ts`: starts both servers together with Bun

## Run Locally

Install dependencies:

```bash
bun install
```

Start both servers:

```bash
bun run dev
```

Run the browser test in another terminal:

```bash
bun run test
```

Open the app manually at `http://localhost:3001/login`. For cookie inspection after sign-in, visit `http://localhost:3001/api/debug/cookies`.

## Expected Result

After sign-in, the browser should leave `/login`, land on `/dashboard`, and show `authenticated`. After clearing cookies, a reload should redirect back to `/login`.

If that passes here, the cross-port cookie mechanism itself is likely sound, and the bug probably lives in the larger app’s SSR, auth client, timing, or environment wiring.

## Evidence and CI

The harness writes screenshots, HAR output, state snapshots, and `recording.webm` to `evidence/auth/`. GitHub Actions in `.github/workflows/cookie-test.yml` starts the Bun servers, curls port `3000`, runs the harness, and uploads `evidence/` plus `logs/` as artifacts.

## Notes

Use Bun commands and Bun APIs by default. This repo is intentionally minimal and avoids depending on Node-specific runtime behavior.
