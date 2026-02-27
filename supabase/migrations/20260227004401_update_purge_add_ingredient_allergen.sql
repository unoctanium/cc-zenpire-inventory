-- Migration: update_purge_add_ingredient_allergen
-- Add ingredient_allergen to the dev purge function (FK child of ingredient)

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
    public.recipe_media,
    public.recipe_step,
    public.recipe_component,
    public.recipe,
    public.ingredient
  restart identity;
end;
$$;
