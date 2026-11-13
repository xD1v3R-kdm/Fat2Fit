# Fat2Fit 0.8 — Acceptance and data-isolation checklist

## Coach-owned data
- Each coach owns exactly one workspace. No other coach gets access through a shared team.
- Membership can include multiple student workspaces. The student chooses their coach in the header.
- A coach may also be a student of another coach, independently.
- Legacy invitations and assignments keep their existing IDs; existing student relationships remain with their inviter.
- Never expose workspace data based only on a client-supplied workspace ID; server checks membership and workspace ownership.

## Coach action center
- Four simultaneous counters, each clickable: workouts today; workouts tomorrow; completed workouts waiting for review; pending video files.
- Counts include only the coach's student assignments, excluding self-training.
- Clicking a counter opens the corresponding filtered list.
- Workout completion has a separate review state: not_required / pending / approved / changes_requested.
- Video reviews retain their existing independent status.

## Monthly measurements
- Due date is one calendar month after each particular student membership's creation, then every month.
- Jan 31 -> Feb 28 (Feb 29 in leap year), Mar 31 and so on.
- Trainer dashboard generates missing due requests idempotently. One row per workspace, student and due date.
- A body measurement entered during the reporting period satisfies it automatically.
- If not reported, the task persists after due date. The coach can send a Telegram request or skip it.
- Requests are sent only on the coach's explicit tap. Telegram delivery failures return the request to pending; successful sends remain waiting until the student reports.
- Students reporting to different coaches store independent reports, even on the same date.

## Student measurement comparison
- The collapsed `My results` banner is above the full measurement log.
- Expanded view compares the chronologically first and latest measurement on each metric.
- Missing values remain dashes; no score or automatic green/red interpretation of increases/decreases.
- With one report, two values are equal but no change is calculated.

## Production checks
- Next.js build and TypeScript must pass.
- `src/lib/report-schedule.ts` date and delta tests must pass.
- Unauthorized `/api/coach-dashboard` and `/api/measurements` requests must fail.
- End-to-end mobile confirmation still requires opening the app in actual Telegram sessions.
