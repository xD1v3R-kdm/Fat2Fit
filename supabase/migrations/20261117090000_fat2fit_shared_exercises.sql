-- Fat2Fit: personal vs shared exercise library.
-- Existing trainer exercises remain private until their owner explicitly publishes.
-- System catalog entries (workspace_id IS NULL) stay available to all teams.
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS fat2fit_shared_exercises_idx
  ON public.exercises(created_at,id)
  WHERE is_shared=true;

COMMENT ON COLUMN public.exercises.is_shared IS
  'Owner opt-in: exercise is visible across coaches. Their private workout/student records are never shared.';

-- Coach Tips remain inside translations JSONB (coachTips key per language),
-- so existing names, descriptions, FAQ and translations stay untouched.
