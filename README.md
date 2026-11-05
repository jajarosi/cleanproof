# cleanproof

Cleaning tracking app for serviced apartments and short-term rentals: cleaners check in, take photo proof, and managers get a timestamped history of every unit.

## Stack
- Next.js (`web/`) — mobile-first web app, FR/EN
- Supabase — Postgres, Auth, Storage (`supabase/migrations/`)

## Setup
1. Create a Supabase project and run the SQL files in `supabase/migrations/` in order (SQL Editor).
2. Authentication > Email: disable "Confirm email".
3. `cd web && cp .env.local.example .env.local` and fill in the keys.
4. `npm install && npm run dev` → http://localhost:3000, then "Create your company space".
