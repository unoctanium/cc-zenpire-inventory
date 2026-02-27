-- Migration: add_v_recipe_comp_cost
-- View that computes the total component cost per recipe.
-- Cost per component = quantity * (component_unit.factor / base_unit.factor) * std_cost
-- where std_cost comes from ingredient.standard_unit_cost or sub_recipe.standard_unit_cost.

CREATE OR REPLACE VIEW v_recipe_comp_cost AS
SELECT
  rc.recipe_id,
  SUM(
    rc.quantity
    * (cu.factor / NULLIF(bu.factor, 0))
    * COALESCE(i.standard_unit_cost, sr.standard_unit_cost)
  ) AS comp_cost
FROM recipe_component rc
JOIN unit cu ON cu.id = rc.unit_id
LEFT JOIN ingredient i ON i.id = rc.ingredient_id
LEFT JOIN unit bu_i ON bu_i.id = i.default_unit_id
LEFT JOIN recipe sr ON sr.id = rc.sub_recipe_id
LEFT JOIN unit bu_sr ON bu_sr.id = sr.output_unit_id
-- pick the right base unit depending on component type
CROSS JOIN LATERAL (
  SELECT COALESCE(bu_i.factor, bu_sr.factor) AS factor
) bu
WHERE
  COALESCE(i.standard_unit_cost, sr.standard_unit_cost) IS NOT NULL
GROUP BY rc.recipe_id;
