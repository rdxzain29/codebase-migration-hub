create or replace function public.enforce_signup_email_domain()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null
     and coalesce(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     and not public.is_allowed_signup_email(new.email)
     -- Lovable's short-lived preview test accounts; example.com has no inboxes, so these can never be confirmed by the public.
     and lower(coalesce(new.email, '')) !~ '^agent-test\+[a-z0-9]+@example\.com$' then
    raise exception 'Only Gmail or Outlook email addresses can create an account'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;