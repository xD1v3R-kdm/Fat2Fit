# Fat2Fit — renaming notes

- Display brand: **Fat2Fit**. Repository and folder: `fat2fit`. Node package: `fat2fit-mini-app`.
- Existing Supabase **project ref stays** `hjckimoritnehwwazszf`. Do **not** delete or recreate the project or tables for branding. Its dashboard label may still read “GymTrack”; renaming that label is a separate dashboard action.
- Historical migration file `20261029233935_gymtrack_foreign_key_indexes.sql` is intentionally unchanged, because it was already applied remotely and recorded under that name.
- Existing React demo browser state under `gymtrack-03-*` keys migrates on load to `fat2fit-03-*` keys.
- Telegram username, Mini App short name, Vercel domain and GitHub repository must be chosen / configured separately. Do not assume @Fat2FitBot is available.
- This is a branding change, not a new SaaS tenant. All database IDs and relationships remain stable.
