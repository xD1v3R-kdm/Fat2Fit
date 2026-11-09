-- Fat2Fit 0.6: trainer's own workouts and student history controls.
alter table public.memberships
  add column if not exists history_visibility text not null default 'full'
  check (history_visibility in ('full','summary'));
alter table public.workout_templates
  add column if not exists workout_type text not null default 'strength'
  check (workout_type in ('strength','circuit','cardio'));
alter table public.assignments
  add column if not exists workout_type text not null default 'strength'
  check (workout_type in ('strength','circuit','cardio'));
-- Existing assignments retain the template's category where available.
update public.assignments a
  set workout_type=t.workout_type
  from public.workout_templates t
  where a.template_id=t.id and a.workout_type is distinct from t.workout_type;
