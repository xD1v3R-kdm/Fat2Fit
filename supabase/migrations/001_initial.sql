-- Fat2Fit 0.3 — apply to Supabase SQL editor or psql on a NEW database.
-- All client data access goes through authenticated Next.js route handlers.
create extension if not exists pgcrypto;

create table public.users (
 id uuid primary key default gen_random_uuid(),
 telegram_id bigint not null unique,
 display_name text not null check(char_length(display_name) between 1 and 120),
 language text not null default 'ru' check(language in ('ru','en','sr')),
 created_at timestamptz not null default now()
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 1 and 100),
 created_at timestamptz not null default now()
);
create table public.memberships (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 role text not null check(role in ('coach','student')),
 created_at timestamptz not null default now(),
 primary key(workspace_id,user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create table public.invitations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 token_hash text not null unique,
 role text not null default 'student' check(role = 'student'),
 created_by uuid not null references public.users(id),
 expires_at timestamptz not null,
 used_at timestamptz,
 used_by uuid references public.users(id),
 created_at timestamptz not null default now()
);
create index invitations_workspace_idx on public.invitations(workspace_id);
create table public.exercises (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid references public.workspaces(id) on delete cascade,
 muscle_group text not null default 'other',
 equipment text not null default '',
 photo_url text not null default '',
 video_url text not null default '',
 translations jsonb not null check(jsonb_typeof(translations)='object'),
 created_by uuid references public.users(id),
 created_at timestamptz not null default now()
);
create index exercises_workspace_idx on public.exercises(workspace_id);
create table public.workout_templates (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title jsonb not null check(jsonb_typeof(title)='object'),
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default now()
);
create index workout_templates_workspace_idx on public.workout_templates(workspace_id);
create table public.template_exercises (
 id uuid primary key default gen_random_uuid(),
 template_id uuid not null references public.workout_templates(id) on delete cascade,
 exercise_id uuid not null references public.exercises(id) on delete restrict,
 position int not null check(position >= 0),
 planned_sets int not null check(planned_sets between 1 and 30),
 planned_reps int not null check(planned_reps between 1 and 1000),
 planned_weight numeric(8,2) not null default 0 check(planned_weight between 0 and 9999),
 rest_seconds int not null default 90 check(rest_seconds between 0 and 3600),
 unique(template_id,position)
);
create table public.assignments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 student_user_id uuid not null references public.users(id),
 template_id uuid references public.workout_templates(id) on delete set null,
 title jsonb not null check(jsonb_typeof(title)='object'),
 scheduled_on date not null,
 status text not null default 'planned' check(status in ('planned','active','completed','skipped')),
 note text not null default '',
 effort int check(effort between 1 and 10),
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(workspace_id,student_user_id) references public.memberships(workspace_id,user_id)
);
create index assignments_student_date_idx on public.assignments(student_user_id, scheduled_on desc);
create index assignments_workspace_date_idx on public.assignments(workspace_id, scheduled_on desc);
create table public.assignment_exercises (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 exercise_id uuid not null references public.exercises(id) on delete restrict,
 position int not null check(position >= 0),
 planned_sets int not null check(planned_sets between 1 and 30),
 planned_reps int not null check(planned_reps between 1 and 1000),
 planned_weight numeric(8,2) not null check(planned_weight between 0 and 9999),
 rest_seconds int not null check(rest_seconds between 0 and 3600),
 unique(assignment_id,position)
);
create table public.set_logs (
 assignment_exercise_id uuid not null references public.assignment_exercises(id) on delete cascade,
 set_index int not null check(set_index between 0 and 29),
 actual_reps int not null check(actual_reps between 0 and 1000),
 actual_weight numeric(8,2) not null check(actual_weight between 0 and 9999),
 done boolean not null default true,
 recorded_at timestamptz not null default now(),
 primary key(assignment_exercise_id,set_index)
);
-- No direct Data API access in 0.3: the server checks sessions, workspace and roles.
-- In Supabase PUBLIC schema default privileges might include anon/authenticated;
-- revoke access explicitly, so RLS is defense in depth rather than the only guard.
do $$ declare tbl text; begin
 foreach tbl in array array['users','workspaces','memberships','invitations','exercises','workout_templates','template_exercises','assignments','assignment_exercises','set_logs'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('revoke all on public.%I from anon, authenticated',tbl);
 end loop;
end $$;
-- No public RLS policies: API-only access through trusted server DB credentials.
-- NEVER expose DATABASE_URL or a Supabase service/secret key in browser code.
