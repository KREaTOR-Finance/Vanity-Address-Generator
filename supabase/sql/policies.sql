drop policy if exists "service-role full access users" on public.users;
create policy "service-role full access users"
  on public.users
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service-role full access payments" on public.payments;
create policy "service-role full access payments"
  on public.payments
  for all
  to service_role
  using (true)
  with check (true);

