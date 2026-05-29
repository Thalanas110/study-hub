-- Remove admin view overrides for groups and members
DROP POLICY IF EXISTS "Admins view all groups" ON public.study_groups;
DROP POLICY IF EXISTS "Admins view all members" ON public.group_members;
