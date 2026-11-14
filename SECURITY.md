# Security and privacy

Fat2Fit is an invite-only pilot that handles workout records, progress measurements and potentially sensitive training videos.

## Reporting a vulnerability

Please **do not open a public GitHub issue** that contains an exploit, personal information, access token, session cookie, private video URL or database credentials.

Contact the project maintainer privately at [komkov.kdm@gmail.com](mailto:komkov.kdm@gmail.com) with a summary and minimal reproduction steps.

Do not attempt to access other people's training data or perform disruptive tests against the live application without explicit permission.

## Security model (summary)

- Telegram `initData` is checked server-side against the bot-token-derived HMAC.
- A signed, HttpOnly session cookie identifies the user after authentication.
- Server routes apply membership, role and coach-workspace ownership checks.
- Private workout videos use short-lived signed upload/playback URLs.
- Secrets are server-side environment variables, not `NEXT_PUBLIC_*` values.
- The public repository contains **code and sanitized configuration examples only**; live account data is stored outside GitHub.

**Important:** These controls are design intentions and implemented mechanisms, not a third-party audit or a guarantee that all vulnerabilities have been eliminated.

## When copying this code

Never commit `.env.local`, real `DATABASE_URL`, Telegram bot tokens, Supabase service keys, session secrets, private certificates or exported user records. Review deployment logs and Git history before changing a previously private repository to public.
