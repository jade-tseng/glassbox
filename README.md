# hackathon-nov26

One-day hackathon project. Specs TBD.

- **Design system:** see [UI.md](UI.md). It is the source of truth for all frontend styling.

## Frontend demo (`web/`)

Next.js (App Router) + Tailwind v4, styled per UI.md.

- Live: https://hackathon-nov26.vercel.app
- Local: `cd web && npm install && npm run dev` → http://localhost:3000
- Deploys: every push to `main` auto-deploys via Vercel (team `jade-ff72`, project `hackathon-nov26`, root directory `web`). Manual: `npx vercel deploy --prod` from the repo root.
