# Fat2Fit — 0 → 1 product case study

**Product:** Invite-only Telegram Mini App for personal training  
**Role:** Product lead, product designer and hands-on builder (with AI-assisted development)  
**Stage:** Live private pilot · November 2026 · v0.8  
**Platform:** Telegram, mobile web, Next.js, PostgreSQL/Supabase, Vercel

[← Project overview](../README.md) · [Architecture](ARCHITECTURE.md) · [Open the app](https://t.me/fat2fitapp_bot/Fat2Fitgymapp)

---

## 01 / Problem

A personal trainer's work happens in more places than the gym: assigning workouts, explaining exercises, tracking completed sets, checking technique videos and asking students for periodic body measurements.

A common lightweight workflow is fragmented across messaging, notes, spreadsheets and media storage. It is fast to start, but creates unnecessary coordination overhead as the number of students grows.

**Working hypothesis:** bringing planning, execution and feedback into a familiar Telegram experience reduces that coordination cost, particularly for trainers managing a small roster.

This is a hypothesis guiding the product; the pilot has not yet established a quantified efficiency improvement.

## 02 / Users and jobs to be done

**Coach**

> When I plan and review several students' workouts, I need one place to see what is scheduled, what was completed and what requires my attention, so I can spend less time chasing information.

**Student**

> When I am training, I need a simple way to follow the session, record what I actually did and see whether I am making progress, without managing another complicated app.

**A coach who trains too**

> When I train myself, I should not need a second Telegram identity or a duplicate user account just to use the same workout-tracking tools.

## 03 / The MVP choice

I narrowed the initial scope to a complete, end-to-end coaching loop:

1. Authenticate with Telegram.
2. Invite a student into a coach-owned workspace.
3. Create or select exercises and assign a workout.
4. Record sets, repetitions and weights.
5. Complete the workout and make the result visible to the coach.
6. Collect feedback and progress data.

This was deliberately narrower than a comprehensive fitness platform. Payments, subscriptions, meal planning, AI workout generation and a consumer marketplace were left out of the MVP.

The principle was **finish one useful workflow before expanding into adjacent features**.

## 04 / What changed after testing

The live pilot exposed usability and workflow gaps that were not obvious in a static prototype.

| Feedback / observation | Product response | Product rationale |
| --- | --- | --- |
| A trainer also wanted to log his own sessions | Coach/student mode within one Telegram account | Avoid duplicate identities and fragmented history |
| Templates were too rigid for spontaneous sessions | Assign workouts directly from selected exercises | Faster ad-hoc planning without creating unnecessary templates |
| Coaches needed to update technique instructions | Edit own exercises and create workspace-specific overrides of shared exercises | Personalize guidance without changing everybody else's catalog |
| Some students should not see detailed exercise history | Coach-controlled full history vs. per-category completion totals | Reflect different coaching styles without removing accountability |
| Navigation and date fields broke on iPhone | Fix WebView layout constraints and four-column student navigation | Mobile usability is a product requirement, not just visual polish |
| A single dashboard headline didn't help coaches prioritize | Four independent workload counters | Make today's next action visible without navigating several tabs |
| Body measurements were just a list of numbers | First-vs-last progress comparison | Answer “what changed?” before “show me every record” |
| More than one coach can work with the same student | Coach-owned workspaces; each student relationship is independent | Prevent accidental sharing of workouts, reporting and progress data |

The sequence matters: each addition came after a useful baseline already existed.

## 05 / Current experience

### For the coach

A coach can create or customize exercise descriptions, build reusable templates or assemble a one-off workout, assign sessions, record sets alongside the student, approve finished workouts and review private technique videos.

The **Coach Action Center** shows four values together: sessions today, sessions tomorrow, workouts awaiting review and videos awaiting review. Monthly measurement reminders appear only when a student is due or overdue for a report; the coach explicitly decides whether to send a Telegram reminder.

### For the student

The student sees assigned sessions, tracks actual sets, records body metrics and can share technique videos for review. **My Results** expands to compare the earliest and most recent measurement records, showing the difference for each metric.

A missing value is not replaced with zero. Weight loss or muscle gain is **not automatically colored as a success or failure**; the app does not know the user's individual fitness goal.

A student can belong to different coaches' workspaces, while their assignments and progress reports remain scoped to each relationship.

## 06 / Product and architecture decisions

### Telegram-first rather than a standalone install

**Benefit:** faster invited onboarding and lower friction for people who already communicate in Telegram.  
**Trade-off:** platform constraints, WebView-specific styling and dependence on Telegram identity.

### Templates *and* ad-hoc assignments

**Benefit:** repeatability for structured programs, speed for everyday coaching.  
**Trade-off:** more complex assignment UX and validation rules than a template-only system.

### Per-coach data ownership

**Benefit:** ownership is clear. Two coaches never need to share a team simply because they train the same student.  
**Trade-off:** the student must switch between coaching workspaces, and measurements are intentionally separate per coach.

### Completion separate from review

**Benefit:** finishing a workout and the coach approving it become two different events.  
**Trade-off:** requires review queues, feedback handling and correction workflows.

### Real calendar months for reporting

**Benefit:** the request cadence matches the student's anniversary date, including short months and leap years.  
**Trade-off:** requires explicit date logic and safeguards against counting one measurement twice.

[**Technical design and trust boundaries →**](ARCHITECTURE.md)

## 07 / Delivery approach

The project went through small vertical increments rather than one large release:

- **Foundation:** Next.js app, signed Telegram login, private PostgreSQL-backed membership, deployment.
- **Coaching loop:** assigned sessions, logged sets, progress visibility, coach-assisted workouts and private technique video review.
- **Progress:** dated body measurements, muscle mass and historical records.
- **Flexibility:** coach self-training, ad-hoc workouts, editable exercise library, three locales.
- **Operational workflow:** coach dashboard, independent relationships, workout review and monthly reporting.
- **Iteration:** mobile layout, contrast, copy/share actions and shorter critical paths.

The implementation involved AI-assisted engineering alongside hands-on product definition, testing and iterative debugging. I treat it as a **product ownership / delivery case**, not as a claim that I hand-coded every module unaided.

## 08 / Outcomes and evidence

**What can be claimed today**

- A working application deployed on Vercel and launched through Telegram.
- A real coach/student workflow connected to PostgreSQL.
- Iterations informed by actual mobile usage and coaching feedback.
- Working server APIs, SQL migrations and automated checks.
- A product with both coach and student interfaces, not just a clickable design prototype.

**What I am not claiming**

- Validated revenue, retention or acquisition metrics.
- A large user base or a publicly available consumer SaaS.
- Independent security certification or fully comprehensive end-to-end QA.
- Proven improvements in trainer productivity before instrumentation.

This distinction is intentional: **evidence matters more than an impressive invented number**.

## 09 / What I would prioritize next

1. **Cross-account E2E regression:** invitation, permissions, one-off assignments, video review, monthly reminders and multi-coach context switching.
2. **Lightweight analytics:** invitation activation, assignment completion, coach response time, monthly report submission and engagement by cohort.
3. **Coaching workflow improvements:** better defaults for recurring plans and clearer review queues.
4. **Privacy and operational readiness:** access-control audit, data deletion/export flows, monitoring and automated recovery checks.

---

**Dmitry Komkov** — Product Lead / Product Manager  
[Portfolio](https://dmitrykomkov.netlify.app) · [LinkedIn](https://www.linkedin.com/in/dmitrykomkov/) · [Email](mailto:komkov.kdm@gmail.com)

[← Back to Fat2Fit](../README.md)
