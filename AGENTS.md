# Repository Guidelines

## Project Structure & Module Organization
- `web/`: Vite + React client; feature code in `web/src`, shared assets in `web/public`, build output in `web/dist`.
- `server/`: Express API rooted at `server/index.js` with configuration hints in `server/env.example`.
- `nginx/`: Reverse-proxy manifests used for deployment hardening; update only when delivery targets change.

## Build, Test, and Development Commands
- `npm install`: Install workspace dependencies after each pull.
- `npm run dev`: Cleans conflicting ports, then launches Vite (`web`) and the API (`server`) together.
- `npm run build`: Runs every workspace build (`web` gets a production bundle).
- `npm run start`: Boots the API only; use when serving a prebuilt client.
- `npm run lint` / `npm run lint:fix`: Run ESLint repo-wide, optionally applying fixes.
- `npm run format` / `npm run format:check`: Apply or verify Prettier formatting.

## Coding Style & Naming Conventions
- Prettier enforces 2-space indentation, 100-character lines (80 in Markdown), and single quotes.
- Favor React function components named `PascalCase` in `web/src`, keeping hooks and styles beside their owner.
- Server modules should export explicit handlers (e.g., `registerImageRoutes`) and lean on structured logging helpers instead of raw `console.log`.
- ESLint flags unused variables (except `_ignored`); treat any warning as a change blocker.

## Testing Guidelines
- Frontend tests live beside components as `<Component>.test.tsx`; run them with `npx vitest` inside `web/`.
- API integration tests belong in `server/__tests__/` using Jest + Supertest; execute them with `npx jest` from the repo root.
- Add coverage for every new endpoint or UI flow and include regression cases for bug fixes.
- Keep fixtures lightweight and prefer shared helpers in `web/src/test-utils/` (create it if missing).

## Commit & Pull Request Guidelines
- Match history style: short, imperative subjects (e.g., `Fix avatar cropping`) with bullet bodies when detail helps.
- Reference related issues in commit bodies or PR descriptions (`Closes #123`) and spell out UX or API impacts.
- PRs should list manual/automated test evidence and attach screenshots or clips for UI changes.
- Run `npm run lint` and the relevant tests locally before requesting review.

## Environment & Secrets
- Copy `server/env.example` to `server/.env` and supply local API keys before running `npm run dev`.
- Never commit secrets; rely on deployment stores and document required keys in the sample file.
