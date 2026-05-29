-- Fix admin_delete_group: remove auth.uid() check (returns NULL via service_role)
-- Admin verification is done server-side before calling this function
CREATE OR REPLACE FUNCTION public.admin_delete_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.study_groups WHERE id = _group_id;
END;
$$;
