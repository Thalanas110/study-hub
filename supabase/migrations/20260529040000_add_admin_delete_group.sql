-- Admin function to delete a group
-- SECURITY DEFINER bypasses RLS; ON DELETE CASCADE handles related records
CREATE OR REPLACE FUNCTION public.admin_delete_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete groups';
  END IF;

  DELETE FROM public.study_groups WHERE id = _group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_group(uuid) TO authenticated;
