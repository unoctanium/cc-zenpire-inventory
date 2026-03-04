-- Drop the recipe_step table (steps replaced by free-text production_notes on recipe)
DROP TABLE IF EXISTS public.recipe_step CASCADE;

-- Add production_notes column to recipe
ALTER TABLE public.recipe ADD COLUMN IF NOT EXISTS production_notes text;

-- Update fn_dev_purge_all to no longer truncate recipe_step
CREATE OR REPLACE FUNCTION public.fn_dev_purge_all()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE TABLE
    public.purchase_receipt_line,
    public.purchase_receipt,
    public.production_batch,
    public.stock_movement,
    public.ingredient_stock,
    public.ingredient_supplier_offer,
    public.supplier_offer_price,
    public.supplier_offer,
    public.supplier,
    public.recipe_media,
    public.recipe_component,
    public.recipe,
    public.ingredient
  RESTART IDENTITY;
END;
$$;
