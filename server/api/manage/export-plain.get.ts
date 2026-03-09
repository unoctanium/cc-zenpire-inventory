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

  async function fetchComponents(recipeIds: string[]) {
    if (recipeIds.length === 0) return []
    const { data, error } = await admin.from('recipe_component').select('*').in('recipe_id', recipeIds)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table recipe_component: ${error.message}` })
    }
    return data ?? []
  }

  const [
    unit,
    allergen,
    ingredientRaw,
    recipeRaw,
  ] = await Promise.all([
    fetchTable('unit'),
    fetchTable('allergen'),
    fetchTable('ingredient'),
    fetchTable('recipe'),
  ])

  const recipe_component = await fetchComponents((recipeRaw as any[]).map((r: any) => r.id))

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
    },
  }
})
