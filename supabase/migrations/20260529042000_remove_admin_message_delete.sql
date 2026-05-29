-- Remove admin message delete policy (privacy: admins should not access messages)
DROP POLICY IF EXISTS "Admins delete any message" ON public.messages;
