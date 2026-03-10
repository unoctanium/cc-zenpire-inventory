-- Phase 3: purchase-price fields on ingredient
-- Allows storing a real-world purchase package (qty + unit + price) so the
-- system can derive standard_unit_cost automatically.
--
-- Formula: standard_unit_cost = purchase_price / (purchase_quantity * unit.factor)
-- (unit.factor converts purchase unit → base unit, e.g. kg → g: factor=1000)

ALTER TABLE public.ingredient
  ADD COLUMN purchase_quantity         numeric(12,4),
  ADD COLUMN purchase_unit_id          uuid REFERENCES public.unit(id),
  ADD COLUMN purchase_price            numeric(12,4),
  ADD COLUMN purchase_price_currency   varchar(3) DEFAULT 'EUR';

COMMENT ON COLUMN public.ingredient.purchase_quantity IS
  'Package quantity in purchase_unit (e.g. 1 for 1 kg)';
COMMENT ON COLUMN public.ingredient.purchase_unit_id IS
  'Unit of the purchase package (e.g. kg)';
COMMENT ON COLUMN public.ingredient.purchase_price IS
  'Price paid for purchase_quantity units (e.g. 0.80 for 1 kg)';
COMMENT ON COLUMN public.ingredient.purchase_price_currency IS
  'ISO 4217 currency code for purchase_price (default EUR)';
