-- Fat2Fit 0.7: workspace-local editing of shared exercises and CG locale.
create table if not exists public.exercise_overrides (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 exercise_id uuid not null references public.exercises(id) on delete cascade,
 muscle_group text not null,
 equipment text not null default '',
 photo_url text not null default '',
 video_url text not null default '',
 translations jsonb not null check(jsonb_typeof(translations)='object'),
 updated_by uuid not null references public.users(id),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,exercise_id)
);
alter table public.exercise_overrides enable row level security;
revoke all on public.exercise_overrides from anon,authenticated;
update public.exercises set translations=(translations-'sr') ||
 jsonb_build_object('cg',coalesce(translations->'cg',translations->'sr'))
 where translations ? 'sr';
update public.workout_templates set title=(title-'sr') ||
 jsonb_build_object('cg',coalesce(title->'cg',title->'sr'))
 where title ? 'sr';
update public.assignments set title=(title-'sr') ||
 jsonb_build_object('cg',coalesce(title->'cg',title->'sr'))
 where title ? 'sr';
alter table public.users drop constraint if exists users_language_check;
update public.users set language='cg' where language='sr';
alter table public.users add constraint users_language_check
 check(language in ('ru','en','cg'));
