-- Migration: add_gs1_code_to_allergen
-- Adds GS1 AllergenTypeCode (T4078) two-letter code to the allergen table.
-- Nullable so user-created custom allergens can omit it.
-- Unique per client when set (upper-cased).

ALTER TABLE public.allergen
  ADD COLUMN code varchar(2);

CREATE UNIQUE INDEX allergen_code_client_key
  ON public.allergen (client_id, upper(code))
  WHERE code IS NOT NULL;
