import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'

/**
 * GET /api/manage/export
 *
 * Returns a snapshot of all business tables as structured JSON.
 * Requires the `admin.export` permission.
 *
 * Export format:
 * {
 *   version:     1,
 *   app:         'zenpire-inventory',
 *   exported_at: <ISO string>,
 *   tables: {
 *     unit, allergen, ingredient, recipe, recipe_component, recipe_step,
 *     supplier, supplier_offer, supplier_offer_price,
 *     ingredient_supplier_offer, ingredient_stock
 *   }
 * }
 *
 * Tables are listed in import-safe dependency order so a future import
 * route can insert them top-to-bottom (with a two-pass for the
 * ingredient ↔ recipe circular FK via produced_by_recipe_id).
 *
 * Not exported: app_user, role, permission, role_permission, user_role
 * (those are deployment-specific, not business data).
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.export')

  const admin = supabaseAdmin()

  async function fetchTable(name: string) {
    const { data, error } = await admin.from(name).select('*')
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table ${name}: ${error.message}` })
    }
    return data ?? []
  }

  // Fetch all tables in parallel — dependency order matters for import, not for export
  const [
    unit,
    allergen,
    ingredient,
    recipe,
    recipe_component,
    recipe_step,
    supplier,
    supplier_offer,
    supplier_offer_price,
    ingredient_supplier_offer,
    ingredient_stock,
  ] = await Promise.all([
    fetchTable('unit'),
    fetchTable('allergen'),
    fetchTable('ingredient'),
    fetchTable('recipe'),
    fetchTable('recipe_component'),
    fetchTable('recipe_step'),
    fetchTable('supplier'),
    fetchTable('supplier_offer'),
    fetchTable('supplier_offer_price'),
    fetchTable('ingredient_supplier_offer'),
    fetchTable('ingredient_stock'),
  ])

  return {
    version:     1,
    app:         'zenpire-inventory',
    exported_at: new Date().toISOString(),
    tables: {
      // Dependency order (safe insert sequence for a future import):
      // 1. No-dependency reference tables
      unit,
      allergen,
      // 2. ingredient depends on unit; produced_by_recipe_id is nullable → insert with NULL, patch after recipes
      ingredient,
      // 3. recipe depends on unit (output_unit_id)
      recipe,
      // 4. join/child tables
      recipe_component,
      recipe_step,
      supplier,
      supplier_offer,
      supplier_offer_price,
      ingredient_supplier_offer,
      ingredient_stock,
    },
  }
})
