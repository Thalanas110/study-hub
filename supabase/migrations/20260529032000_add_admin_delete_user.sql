-- Allow admins to delete user accounts and related data
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Admins cannot delete their own account';
  END IF;

  -- Remove user-owned data
  DELETE FROM public.group_members WHERE user_id = target_user_id;
  DELETE FROM public.messages WHERE user_id = target_user_id;
  DELETE FROM public.quiz_attempts WHERE user_id = target_user_id;
  DELETE FROM public.notes WHERE author_id = target_user_id;
  DELETE FROM public.quizzes WHERE author_id = target_user_id;

  -- Remove groups hosted by the user (cascades to members, notes, quizzes, questions, messages)
  DELETE FROM public.study_groups WHERE host_id = target_user_id;

  -- Remove profile and roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  -- Remove auth user
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
