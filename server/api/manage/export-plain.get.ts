import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'

/**
 * GET /api/manage/export-plain
 *
 * Same as /api/manage/export but with image_data and image_mime stripped
 * (set to null) on ingredient and recipe rows.  Produces a much smaller
 * file — images are lost but all other business data is preserved.
 *
 * Requires the `admin.export` permission.
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

  const [
    unit,
    allergen,
    ingredientRaw,
    recipeRaw,
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

  const ingredient = (ingredientRaw as any[]).map(r => ({ ...r, image_data: null, image_mime: null }))
  const recipe     = (recipeRaw     as any[]).map(r => ({ ...r, image_data: null, image_mime: null }))

  return {
    version:     1,
    app:         'zenpire-inventory',
    exported_at: new Date().toISOString(),
    plain:       true,
    tables: {
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
    },
  }
})
