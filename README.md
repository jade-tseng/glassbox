# Glassbox

Glassbox — built in a one-day hackathon. Specs TBD.

- **Design system:** see [UI.md](UI.md). It is the source of truth for all frontend styling.
- **Gemini reference:** see [docs/GEMINI.md](docs/GEMINI.md) (model IDs, Interactions API rules). Helper: `web/src/lib/gemini.ts`, check: `/api/gemini/ping`.

## Frontend demo (`web/`)

Next.js (App Router) + Tailwind v4, styled per UI.md.

- Live: https://miniglass.vercel.app
- Local: `cd web && npm install && npm run dev` → http://localhost:3000
- Deploys: every push to `main` auto-deploys via Vercel (team `jade-ff72`, project `glassbox`, root directory `web`). Commits must be authored by GitHub user `jade-tseng` (repo git email is set to its noreply address). Manual: `npx vercel deploy --prod` from the repo root.
- Data: MongoDB Atlas project `glassbox`, M0 cluster `glassbox`, db `glassbox`. Env vars live in `web/.env.local` (gitignored) and Vercel. Health check: `/api/health`.
