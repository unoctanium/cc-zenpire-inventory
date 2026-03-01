-- Migration: update_purge_remove_recipe_media
-- recipe_media was dropped in 20260228000002_add_inline_images.
-- Remove it from fn_dev_purge_all so purge no longer fails.

create or replace function public.fn_dev_purge_all()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  truncate table
    public.purchase_receipt_line,
    public.purchase_receipt,
    public.production_batch,
    public.stock_movement,
    public.ingredient_stock,
    public.ingredient_supplier_offer,
    public.ingredient_allergen,
    public.supplier_offer_price,
    public.supplier_offer,
    public.supplier,
    public.recipe_step,
    public.recipe_component,
    public.recipe,
    public.ingredient,
    public.allergen,
    public.unit
  restart identity;
end;
$$;
