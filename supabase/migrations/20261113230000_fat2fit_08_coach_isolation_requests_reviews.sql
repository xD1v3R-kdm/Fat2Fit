-- Fat2Fit 0.8: one private workspace per coach, many student workspaces,
-- independent monthly reports and review states. Existing IDs/data are preserved.
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.users(id);
UPDATE public.workspaces w
SET owner_user_id=(
  SELECT m.user_id FROM public.memberships m
  WHERE m.workspace_id=w.id AND m.role='coach'
  ORDER BY m.created_at,m.user_id LIMIT 1
)
WHERE w.owner_user_id IS NULL;
DO $$
DECLARE extra record; own_ws uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.workspaces WHERE owner_user_id IS NULL) THEN
  RAISE EXCEPTION 'Cannot migrate workspace without a coach owner';
 END IF;
 -- Split legacy shared trainer workspace. An invited coach keeps their
 -- original membership as a student of the original trainer.
 FOR extra IN
  SELECT m.workspace_id,m.user_id,u.display_name
  FROM public.memberships m JOIN public.workspaces w ON w.id=m.workspace_id
  JOIN public.users u ON u.id=m.user_id
  WHERE m.role='coach' AND m.user_id<>w.owner_user_id
  ORDER BY m.created_at
 LOOP
  IF EXISTS(SELECT 1 FROM public.invitations i
    WHERE i.workspace_id=extra.workspace_id AND i.used_by=extra.user_id) THEN
   UPDATE public.memberships SET role='student'
   WHERE workspace_id=extra.workspace_id AND user_id=extra.user_id;
  ELSE
   DELETE FROM public.memberships
   WHERE workspace_id=extra.workspace_id AND user_id=extra.user_id;
  END IF;
  INSERT INTO public.workspaces(name,owner_user_id)
    VALUES(left(extra.display_name || ' · Fat2Fit',100),extra.user_id)
    RETURNING id INTO own_ws;
  INSERT INTO public.memberships(workspace_id,user_id,role)
    VALUES(own_ws,extra.user_id,'coach');
 END LOOP;
END $$;
ALTER TABLE public.workspaces ALTER COLUMN owner_user_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fat2fit_workspace_coach_unique
 ON public.workspaces(owner_user_id);
ALTER TABLE public.assignments
 ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'not_required'
 CHECK (review_status IN ('not_required','pending','approved','changes_requested'));
ALTER TABLE public.assignments
 ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.users(id);
ALTER TABLE public.assignments
 ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.assignments
 ADD COLUMN IF NOT EXISTS review_note text NOT NULL DEFAULT ''
 CHECK (char_length(review_note)<=2000);
UPDATE public.assignments a
 SET review_status='pending'
 FROM public.workspaces w
 WHERE a.workspace_id=w.id AND a.status='completed'
 AND a.student_user_id<>w.owner_user_id AND a.review_status='not_required';
CREATE INDEX IF NOT EXISTS fat2fit_pending_assignment_reviews
 ON public.assignments(workspace_id,review_status)
 WHERE status='completed' AND review_status='pending';
CREATE TABLE IF NOT EXISTS public.measurement_requests(
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 student_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 due_on date NOT NULL,
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','sending','sent','completed','skipped')),
 requested_at timestamptz,
 completed_at timestamptz,
 skipped_at timestamptz,
 completed_measurement_id uuid REFERENCES public.body_measurements(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,student_user_id,due_on),
 FOREIGN KEY(workspace_id,student_user_id)
   REFERENCES public.memberships(workspace_id,user_id)
);
CREATE INDEX IF NOT EXISTS fat2fit_measurement_requests_pending
 ON public.measurement_requests(workspace_id,due_on)
 WHERE status IN ('pending','sent');
ALTER TABLE public.measurement_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.measurement_requests FROM anon,authenticated;
