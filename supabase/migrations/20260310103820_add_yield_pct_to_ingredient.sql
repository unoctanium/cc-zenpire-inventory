-- Phase 4: yield percentage on ingredient
--
-- yield_pct represents the usable fraction after preparation losses
-- (e.g. 80 for a potato: 20% lost to peeling).
-- Default 100 = no loss.
--
-- Effect on costing:
--   effective_unit_cost = standard_unit_cost / (yield_pct / 100)
--   e.g. potato @ €0.001/g with 80% yield → €0.00125/g effective cost

ALTER TABLE public.ingredient
  ADD COLUMN yield_pct numeric(6,2) NOT NULL DEFAULT 100.00
    CONSTRAINT ingredient_yield_pct_check CHECK (yield_pct > 0 AND yield_pct <= 100);

COMMENT ON COLUMN public.ingredient.yield_pct IS
  'Usable yield after prep losses, as a percentage (1–100). Default 100 = no loss.';

-- Update v_recipe_comp_cost to apply yield when calculating component costs.
-- The cost per base unit of an ingredient is: standard_unit_cost / (yield_pct / 100)

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
  root_recipe_id                                                             AS recipe_id,
  SUM(
    ct.effective_qty_base
    / NULLIF(bu.factor, 0)
    * i.standard_unit_cost
    / NULLIF(i.yield_pct / 100.0, 0)
  )                                                                          AS comp_cost
FROM comp_tree ct
JOIN public.ingredient i ON i.id = ct.ingredient_id
JOIN public.unit bu      ON bu.id = i.default_unit_id
WHERE ct.ingredient_id IS NOT NULL
  AND i.standard_unit_cost IS NOT NULL
GROUP BY ct.root_recipe_id;
