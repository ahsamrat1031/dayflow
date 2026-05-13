# Dayflow

**Dayflow** is a minimal, premium daily task tracker built for personal productivity. Plan by date, stay focused, and celebrate progress without clutter.

- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn-style UI, Lucide, Framer Motion, Supabase (Auth + Postgres + Realtime)
- **Principles:** No hard deletes, optimistic updates, keyboard shortcuts, dark mode, mobile-first layout

---

## Quick start

### 1. Install dependencies

```bash
cd dayflow
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase project values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (Settings → API) |

### 3. Supabase setup

1. Create a project at [https://supabase.com](https://supabase.com).
2. In **SQL Editor**, run the script in `supabase/schema.sql` (table, triggers, RLS, indexes).
3. **Authentication → Providers:** enable **Email** (password). Optionally configure email templates and site URL (e.g. `http://localhost:3000` for dev, production URL for prod).
4. **Database → Replication:** enable replication for `public.tasks` (add the table to the `supabase_realtime` publication). Example SQL (also commented in `schema.sql`):

   ```sql
   alter publication supabase_realtime add table public.tasks;
   ```

5. Confirm **RLS** is enabled on `tasks` and policies match your app (the schema file creates `select`, `insert`, and `update` for `auth.uid() = user_id`).

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up or sign in, then use the dashboard.

---

## Deploying

### Vercel (frontend)

1. Push the repo to GitHub (or connect your folder).
2. In [Vercel](https://vercel.com), **New Project** → import the repo (root `dayflow` or monorepo subpath).
3. Add environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. Set **Framework Preset** to Next.js if prompted.

### Supabase (backend)

Already hosted by Supabase. After deployment, update **Authentication → URL configuration** with your Vercel domain (Site URL and Redirect URLs).

---

## Features

- Date picker + “new task” scoped to the selected day  
- Pending vs completed sections (completed tasks stay in the database; UI moves them)  
- Inline edit with save/cancel  
- Search and filters: All, Today, Upcoming, Completed  
- Grouping by `task_date` with readable headings  
- Drag-and-drop reorder for **pending** tasks (per day)  
- Streaks from completion days, lightweight analytics, CSV export of completed tasks  
- Realtime task sync, local `localStorage` cache backup, toasts, loading states, keyboard shortcuts (`⌘/Ctrl+K`, `/`, `N`)

---

## Project structure (high level)

```
src/
  app/                 # Routes (App Router)
  components/
    dashboard/         # Dashboard-specific UI
    ui/                # Reusable primitives (shadcn-style)
  lib/
    actions/           # Server actions (tasks)
    supabase/          # Browser + server clients
    types/             # Shared TypeScript types
supabase/
  schema.sql           # Table, triggers, RLS, replication notes
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |

---

## Security notes

- Never expose the **service role** key in the browser; the app uses only the **anon** key with RLS.
- There is **no delete policy** on `tasks` by design; the app never hard-deletes rows.

---

## License

MIT — use freely for personal projects.
