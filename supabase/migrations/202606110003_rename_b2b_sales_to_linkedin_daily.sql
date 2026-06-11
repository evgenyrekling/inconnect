update public.intelligence_subscriptions
set intelligence_type = 'linkedin_daily',
    updated_at = now()
where intelligence_type = 'b2b_sales';

notify pgrst, 'reload schema';
