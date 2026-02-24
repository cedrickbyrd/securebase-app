-- Only allow select if the user has logged in with MFA (aal2)
create policy "Enforce MFA for sensitive data"
  on sensitive_data
  for select
  using (
    (select auth.jwt()->>'aal') = 'aal2'
  );
