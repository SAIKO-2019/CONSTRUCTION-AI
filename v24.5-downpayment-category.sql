-- SAIKO Construction AI v24.5
-- Add a dedicated Downpayment record category for GenCon billing.

alter table public.billings
  add column if not exists billing_category text not null default 'Billing';

update public.billings
set billing_category = case
  when variation_no is not null and trim(variation_no) <> '' then 'VO'
  else coalesce(nullif(trim(billing_category),''),'Billing')
end;

alter table public.billings
  drop constraint if exists billings_billing_category_check;

alter table public.billings
  add constraint billings_billing_category_check
  check (billing_category in ('Billing','Downpayment','VO'));

grant select, insert, update, delete on public.billings to authenticated;
notify pgrst, 'reload schema';

do $$
begin
  if to_regprocedure('public.bump_system_release(text)') is not null then
    perform public.bump_system_release('v24.5 downpayment category + dashboard project summary');
  end if;
end $$;

select 'v24.5 ready' as result;
