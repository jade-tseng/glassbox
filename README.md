# hackathon-nov26

One-day hackathon project. Specs TBD.

- **Design system:** see [UI.md](UI.md). It is the source of truth for all frontend styling.
- **Gemini reference:** see [docs/GEMINI.md](docs/GEMINI.md) (model IDs, Interactions API rules). Helper: `web/src/lib/gemini.ts`, check: `/api/gemini/ping`.

## Frontend demo (`web/`)

Next.js (App Router) + Tailwind v4, styled per UI.md.

- Live: https://hackathon-nov26.vercel.app
- Local: `cd web && npm install && npm run dev` → http://localhost:3000
- Deploys: every push to `main` auto-deploys via Vercel (team `jade-ff72`, project `hackathon-nov26`, root directory `web`). Commits must be authored by GitHub user `jade-tseng` (repo git email is set to its noreply address). Manual: `npx vercel deploy --prod` from the repo root.
- Data: MongoDB Atlas project `hackathon-nov26`, M0 cluster `hackathon`, db `hackathon`. Env vars live in `web/.env.local` (gitignored) and Vercel. Health check: `/api/health`.
