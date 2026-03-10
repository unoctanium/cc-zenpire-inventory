-- Migration: recipe_cost_recursive_and_sync
--
-- 1. Index on recipe_component.sub_recipe_id for efficient recursive lookups
-- 2. Trigger to keep ingredient.standard_unit_cost in sync with recipe.standard_unit_cost
--    when a pre-product recipe's cost is updated
-- 3. Replace v_recipe_comp_cost with a recursive CTE version that correctly
--    propagates costs through arbitrarily deep pre-product trees

-- ── 1. Index ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_recipe_component_sub_recipe_id
  ON public.recipe_component(sub_recipe_id)
  WHERE sub_recipe_id IS NOT NULL;

-- ── 2. Cost sync trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sync_recipe_cost_to_ingredient()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.ingredient
  SET standard_unit_cost = NEW.standard_unit_cost
  WHERE produced_by_recipe_id = NEW.id
    AND client_id = NEW.client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recipe_cost_sync ON public.recipe;

CREATE TRIGGER trg_recipe_cost_sync
  AFTER UPDATE OF standard_unit_cost ON public.recipe
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_recipe_cost_to_ingredient();

-- ── 3. Recursive v_recipe_comp_cost ──────────────────────────────────────────
-- Each leaf component contributes:
--   effective_qty_base / ingredient_base_unit.factor * ingredient.standard_unit_cost
--
-- When recursing into a sub-recipe, the scale is:
--   parent_effective_qty_base / (sub_recipe.output_quantity * sub_recipe_output_unit.factor)
-- multiplied by the child component's quantity in base units.

CREATE OR REPLACE VIEW public.v_recipe_comp_cost AS
WITH RECURSIVE comp_tree(root_recipe_id, ingredient_id, sub_recipe_id, effective_qty_base, depth) AS (
  -- Base: direct components of each recipe (quantity converted to component's base unit)
  SELECT
    rc.recipe_id                  AS root_recipe_id,
    rc.ingredient_id,
    rc.sub_recipe_id,
    rc.quantity * cu.factor       AS effective_qty_base,
    1                             AS depth
  FROM public.recipe_component rc
  JOIN public.unit cu ON cu.id = rc.unit_id

  UNION ALL

  -- Recurse: expand sub-recipes, scaling quantities by usage fraction
  SELECT
    ct.root_recipe_id,
    rc.ingredient_id,
    rc.sub_recipe_id,
    ct.effective_qty_base
      / NULLIF(sr.output_quantity * ou.factor, 0)
      * rc.quantity * cu.factor   AS effective_qty_base,
    ct.depth + 1
  FROM comp_tree ct
  JOIN public.recipe sr           ON sr.id = ct.sub_recipe_id
  JOIN public.unit ou             ON ou.id = sr.output_unit_id
  JOIN public.recipe_component rc ON rc.recipe_id = sr.id
  JOIN public.unit cu             ON cu.id = rc.unit_id
  WHERE ct.sub_recipe_id IS NOT NULL
    AND ct.depth < 10
)
SELECT
  root_recipe_id                                                       AS recipe_id,
  SUM(
    ct.effective_qty_base
    / NULLIF(bu.factor, 0)
    * i.standard_unit_cost
  )                                                                    AS comp_cost
FROM comp_tree ct
JOIN public.ingredient i ON i.id = ct.ingredient_id
JOIN public.unit bu      ON bu.id = i.default_unit_id
WHERE ct.ingredient_id IS NOT NULL
  AND i.standard_unit_cost IS NOT NULL
GROUP BY ct.root_recipe_id;
