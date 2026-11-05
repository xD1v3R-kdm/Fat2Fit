# Supabase Fat2Fit verification — 2026-10-29 (UTC)

Remote Fat2Fit project reference: `hjckimoritnehwwazszf` (eu-west-1, PostgreSQL 17).

- 10 application tables already existed before the latest work. Do not rerun 001_initial.sql.
- 4 global exercises, all with Russian, English and Serbian translations, already existed. Do not rerun 002_seed_catalog.sql.
- Every application table had RLS enabled.
- `anon` and `authenticated` direct SELECT / INSERT grants were absent for every application table; this is intentional because the Next.js API owns auth and uses the server Postgres connection.
- Applied and confirmed remote migration `20261029233935_gymtrack_foreign_key_indexes` adding 8 foreign-key indexes.
- Current remote migration history records only the index migration. The initial schema and catalog were applied previously outside Supabase migration tracking; they must be baselined before adopting an automated `supabase db push` workflow.
- Advisory `RLS Enabled No Policy` is informational in this API-only architecture, not a suggestion to add permissive policies.
- `Unused Index` informational advisory is expected on an empty test database.

No application users/workspaces/assignments were present at inspection time. First coach workspace is created upon verified Telegram login once the app is deployed and configured.

**Not done:** Vercel publication, live Telegram bot authorization, two-account integration test.

**Naming:** Supabase project display name may still show `GymTrack`. The existing project ID and migrations remain unchanged; renaming does not require rebuilding the database.
