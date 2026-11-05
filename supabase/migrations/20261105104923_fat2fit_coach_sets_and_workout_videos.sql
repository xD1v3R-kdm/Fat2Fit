-- Fat2Fit 0.4: coach-assisted tracking and video technique review. Private bucket: signed URLs only.
alter table public.set_logs add column if not exists recorded_by uuid references public.users(id);
create index if not exists set_logs_recorded_by_idx on public.set_logs(recorded_by);
create table if not exists public.workout_videos (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 assignment_exercise_id uuid not null references public.assignment_exercises(id) on delete cascade,
 uploaded_by uuid not null references public.users(id),
 storage_path text not null unique,
 mime_type text not null check (mime_type in ('video/mp4','video/quicktime','video/webm')),
 bytes_declared bigint not null check (bytes_declared>0 and bytes_declared<=52428800),
 set_index integer check (set_index between 0 and 29),
 status text not null default 'uploading' check (status in ('uploading','pending','approved','changes_requested')),
 review_note text not null default '',
 reviewed_by uuid references public.users(id),
 reviewed_at timestamptz,
 uploaded_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists workout_videos_assignment_idx on public.workout_videos(assignment_id,created_at desc);
create index if not exists workout_videos_item_idx on public.workout_videos(assignment_exercise_id);
create index if not exists workout_videos_uploaded_by_idx on public.workout_videos(uploaded_by);
create index if not exists workout_videos_reviewed_by_idx on public.workout_videos(reviewed_by);
alter table public.workout_videos enable row level security;
revoke all on public.workout_videos from anon, authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('fat2fit-workout-videos','fat2fit-workout-videos',false,52428800,array['video/mp4','video/quicktime','video/webm']::text[])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;
