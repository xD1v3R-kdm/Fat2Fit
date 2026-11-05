-- Applied remotely in the existing Fat2Fit (formerly GymTrack) Supabase project.
-- Migration version: 20261029233935
create index if not exists idx_assignment_exercises_exercise on public.assignment_exercises(exercise_id);
create index if not exists idx_assignments_template on public.assignments(template_id);
create index if not exists idx_assignments_workspace_student on public.assignments(workspace_id,student_user_id);
create index if not exists idx_exercises_created_by on public.exercises(created_by);
create index if not exists idx_invitations_created_by on public.invitations(created_by);
create index if not exists idx_invitations_used_by on public.invitations(used_by);
create index if not exists idx_template_exercises_exercise on public.template_exercises(exercise_id);
create index if not exists idx_workout_templates_created_by on public.workout_templates(created_by);
