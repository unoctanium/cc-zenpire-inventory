-- Migration: alter_recipe_for_module
-- Adds is_active / is_pre_product flags to recipe
-- Converts recipe_component to polymorphic (ingredient OR sub-recipe)

-- Add flags to recipe
ALTER TABLE recipe
  ADD COLUMN IF NOT EXISTS is_active      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_pre_product boolean NOT NULL DEFAULT false;

-- Extend recipe_component to be polymorphic
-- 1. Drop composite PK (recipe_id, ingredient_id)
ALTER TABLE recipe_component DROP CONSTRAINT IF EXISTS recipe_component_pkey;

-- 2. Add surrogate PK and new columns
ALTER TABLE recipe_component
  ADD COLUMN IF NOT EXISTS id           uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS sub_recipe_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order   integer NOT NULL DEFAULT 0;

-- 3. Make ingredient_id nullable
ALTER TABLE recipe_component ALTER COLUMN ingredient_id DROP NOT NULL;

-- 4. New PK on id
ALTER TABLE recipe_component ADD CONSTRAINT recipe_component_pkey PRIMARY KEY (id);

-- 5. FK for sub_recipe_id → recipe
ALTER TABLE recipe_component
  ADD CONSTRAINT recipe_component_sub_recipe_id_fkey
  FOREIGN KEY (sub_recipe_id) REFERENCES recipe(id) ON DELETE CASCADE;

-- 6. XOR check: exactly one of ingredient_id / sub_recipe_id must be set
ALTER TABLE recipe_component
  ADD CONSTRAINT recipe_component_type_check CHECK (
    (ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR
    (ingredient_id IS NULL     AND sub_recipe_id IS NOT NULL)
  );
