-- Migration: update_purge_for_multitenancy
-- Updates fn_dev_purge_all to exclude client / store / app_user (infrastructure)
-- and keep only the business-data tables. client_id columns mean the TRUNCATE
-- still clears all clients' data — acceptable for a DEV-only tool.

CREATE OR REPLACE FUNCTION public.fn_dev_purge_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  TRUNCATE TABLE
    public.ingredient_allergen,
    public.recipe_component,
    public.recipe,
    public.ingredient,
    public.allergen,
    public.unit
  RESTART IDENTITY;
END;
$$;
