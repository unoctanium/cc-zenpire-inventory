-- Migration: drop_supplier_stock_tables
-- Remove all supplier/purchasing and stock/production tables and related RPC functions.

-- Drop RPC functions first
DROP FUNCTION IF EXISTS public.fn_post_production_batch(jsonb);
DROP FUNCTION IF EXISTS public.fn_post_adjustment(jsonb);

-- Drop tables with CASCADE to handle all dependent views automatically
DROP TABLE IF EXISTS public.purchase_receipt_line CASCADE;
DROP TABLE IF EXISTS public.purchase_receipt CASCADE;
DROP TABLE IF EXISTS public.production_batch CASCADE;
DROP TABLE IF EXISTS public.stock_movement CASCADE;
DROP TABLE IF EXISTS public.ingredient_stock CASCADE;
DROP TABLE IF EXISTS public.ingredient_supplier_offer CASCADE;
DROP TABLE IF EXISTS public.supplier_offer_price CASCADE;
DROP TABLE IF EXISTS public.supplier_offer CASCADE;
DROP TABLE IF EXISTS public.supplier CASCADE;

-- Update fn_dev_purge_all: remove dropped tables from TRUNCATE list
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
