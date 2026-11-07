# hackathon-nov26

One-day hackathon project. The frontend demo is a Next.js app in `web/`.

- **Design:** `UI.md` is the source of truth for all frontend styling. Read it before touching UI.
- **AI:** `docs/GEMINI.md` covers model IDs and Interactions API rules (Gemini 4 Argon). Use `web/src/lib/gemini.ts`. Never pass temperature/top_p/top_k/thinking_budget.
- **Data:** MongoDB Atlas via `web/src/lib/mongodb.ts` (`getDb()`). Health check is at `/api/health`.
- **Secrets:** they live in `web/.env.local` (gitignored) and Vercel env. Never commit them. Keep the variable names in `web/.env.example` up to date.
- **Deploy:** pushing to `main` auto-deploys to https://hackathon-nov26.vercel.app (Vercel team `jade-ff72`, root dir `web`). Commits must be authored by GitHub user `jade-tseng`; the repo's git email is already set to its noreply address.
- **Local dev:** `cd web && npm run dev -- -p 3101` (port 3000 is used by another project).
