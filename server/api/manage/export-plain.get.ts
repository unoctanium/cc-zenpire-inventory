import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'
import { resolveAppUser }     from '~/server/utils/resolve-app-user'

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
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()

  async function fetchTable(name: string) {
    const { data, error } = await admin.from(name).select('*').eq('client_id', clientId)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table ${name}: ${error.message}` })
    }
    return data ?? []
  }

  async function fetchByParent(table: string, parentCol: string, parentIds: string[]) {
    if (parentIds.length === 0) return []
    const { data, error } = await admin.from(table).select('*').in(parentCol, parentIds)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table ${table}: ${error.message}` })
    }
    return data ?? []
  }

  const [unit, allergen, ingredientRaw, recipeRaw] = await Promise.all([
    fetchTable('unit'),
    fetchTable('allergen'),
    fetchTable('ingredient'),
    fetchTable('recipe'),
  ])

  const allergenIds   = (allergen    as any[]).map((r: any) => r.id)
  const ingredientIds = (ingredientRaw as any[]).map((r: any) => r.id)
  const recipeIds     = (recipeRaw     as any[]).map((r: any) => r.id)

  const [allergen_i18n, ingredient_i18n, recipe_i18n, recipe_component] = await Promise.all([
    fetchByParent('allergen_i18n',   'allergen_id',   allergenIds),
    fetchByParent('ingredient_i18n', 'ingredient_id', ingredientIds),
    fetchByParent('recipe_i18n',     'recipe_id',     recipeIds),
    fetchByParent('recipe_component','recipe_id',     recipeIds),
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
      allergen_i18n,
      ingredient_i18n,
      recipe_i18n,
    },
  }
})
