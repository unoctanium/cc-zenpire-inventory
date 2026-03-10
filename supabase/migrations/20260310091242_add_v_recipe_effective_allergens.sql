-- Migration: add_v_recipe_effective_allergens
--
-- View that returns the effective allergen set for each recipe by recursively
-- traversing the full recipe_component tree (sub-recipes included).
-- Used by the allergen matrix and produced-ingredient detail.

CREATE OR REPLACE VIEW public.v_recipe_effective_allergens AS
WITH RECURSIVE recipe_tree(root_recipe_id, ingredient_id, sub_recipe_id, depth) AS (
  -- Base: direct components of each recipe
  SELECT
    rc.recipe_id   AS root_recipe_id,
    rc.ingredient_id,
    rc.sub_recipe_id,
    1              AS depth
  FROM public.recipe_component rc

  UNION ALL

  -- Recurse: expand sub-recipe components
  SELECT
    ct.root_recipe_id,
    rc.ingredient_id,
    rc.sub_recipe_id,
    ct.depth + 1
  FROM recipe_tree ct
  JOIN public.recipe_component rc ON rc.recipe_id = ct.sub_recipe_id
  WHERE ct.sub_recipe_id IS NOT NULL
    AND ct.depth < 10
)
SELECT DISTINCT
  rt.root_recipe_id AS recipe_id,
  ia.allergen_id
FROM recipe_tree rt
JOIN public.ingredient_allergen ia ON ia.ingredient_id = rt.ingredient_id
WHERE rt.ingredient_id IS NOT NULL;
