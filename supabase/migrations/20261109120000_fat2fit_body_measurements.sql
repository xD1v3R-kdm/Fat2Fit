-- Fat2Fit 0.5: body measurements for coach/student tracking.
-- Restricted to authenticated server-side PostgreSQL connections.
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  student_user_id uuid not null references public.users(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 10 and 500),
  waist_cm numeric(6,2) check (waist_cm is null or waist_cm between 20 and 300),
  chest_cm numeric(6,2) check (chest_cm is null or chest_cm between 20 and 300),
  biceps_cm numeric(6,2) check (biceps_cm is null or biceps_cm between 10 and 150),
  thigh_cm numeric(6,2) check (thigh_cm is null or thigh_cm between 10 and 200),
  hips_cm numeric(6,2) check (hips_cm is null or hips_cm between 20 and 300),
  note text not null default '' check (char_length(note)<=500),
  recorded_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_measurements_student_membership_fkey
    foreign key (workspace_id,student_user_id) references public.memberships(workspace_id,user_id),
  constraint body_measurements_one_record_per_date
    unique(workspace_id,student_user_id,measured_on),
  constraint body_measurements_has_value check (num_nonnulls(weight_kg,waist_cm,chest_cm,biceps_cm,thigh_cm,hips_cm)>0)
);
create index if not exists body_measurements_recorded_by_idx on public.body_measurements(recorded_by);
alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from anon, authenticated;
