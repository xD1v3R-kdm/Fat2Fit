-- Read-only SQL to paste into Supabase SQL Editor AFTER applying migrations 001 and 002.
-- All 10 expected tables should appear with row_security=true.
select c.relname as table_name, c.relrowsecurity as row_security
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname = any(array[
   'users','workspaces','memberships','invitations','exercises',
   'workout_templates','template_exercises','assignments','assignment_exercises','set_logs'
  ])
order by c.relname;
-- Expected: at least 4 global exercises after the seed migration.
select count(*) as global_exercise_count from public.exercises where workspace_id is null;
-- Expected: all table privileges FALSE for anon and authenticated.
select c.relname as table_name,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
  and c.relname = any(array[
   'users','workspaces','memberships','invitations','exercises',
   'workout_templates','template_exercises','assignments','assignment_exercises','set_logs'
  ])
order by c.relname;
