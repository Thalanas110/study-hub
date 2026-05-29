-- Remove admin override from group visibility policies
DROP POLICY IF EXISTS "Groups viewable by members" ON public.study_groups;
CREATE POLICY "Groups viewable by members" ON public.study_groups
  FOR SELECT TO authenticated
  USING (
    host_id = auth.uid()
    OR public.is_group_member(id)
  );

DROP POLICY IF EXISTS "Members viewable by group members" ON public.group_members;
CREATE POLICY "Members viewable by group members" ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_group_member(group_id)
    OR EXISTS (
      SELECT 1 FROM public.study_groups g
      WHERE g.id = group_id AND g.host_id = auth.uid()
    )
  );
