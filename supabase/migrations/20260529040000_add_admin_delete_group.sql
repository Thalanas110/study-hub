-- Admin function to delete a group and all related data
-- Uses SECURITY DEFINER to bypass RLS, ensuring admins can always delete groups
CREATE OR REPLACE FUNCTION public.admin_delete_group(_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid := auth.uid();
BEGIN
  -- Verify caller is an admin
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete groups';
  END IF;

  -- Delete related records (CASCADE handles most, but we clean up explicitly for clarity)
  DELETE FROM public.quiz_attempts WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE group_id = _group_id);
  DELETE FROM public.quiz_questions WHERE quiz_id IN (SELECT id FROM public.quizzes WHERE group_id = _group_id);
  DELETE FROM public.quizzes WHERE group_id = _group_id;
  DELETE FROM public.notes WHERE group_id = _group_id;
  DELETE FROM public.messages WHERE group_id = _group_id;
  DELETE FROM public.group_members WHERE group_id = _group_id;
  DELETE FROM public.study_groups WHERE id = _group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_group(uuid) TO authenticated;
