-- Add name_translation_locked flag to ingredient and recipe
-- When true, the name field is excluded from automatic translation
ALTER TABLE public.ingredient
  ADD COLUMN name_translation_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.recipe
  ADD COLUMN name_translation_locked boolean NOT NULL DEFAULT false;
