-- Allow PostgREST to embed host profile via study_groups.host_id -> profiles.user_id
ALTER TABLE public.study_groups
  ADD CONSTRAINT study_groups_host_id_fkey
  FOREIGN KEY (host_id)
  REFERENCES public.profiles (user_id)
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE public.study_groups
  VALIDATE CONSTRAINT study_groups_host_id_fkey;
