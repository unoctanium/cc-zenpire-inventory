import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'
import { resolveAppUser }     from '~/server/utils/resolve-app-user'

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
 *     unit, allergen, ingredient, recipe, recipe_component
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
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()

  async function fetchTable(name: string) {
    const { data, error } = await admin.from(name).select('*').eq('client_id', clientId)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table ${name}: ${error.message}` })
    }
    return data ?? []
  }

  // recipe_component has no client_id — fetch via recipe IDs
  async function fetchComponents(recipeIds: string[]) {
    if (recipeIds.length === 0) return []
    const { data, error } = await admin.from('recipe_component').select('*').in('recipe_id', recipeIds)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table recipe_component: ${error.message}` })
    }
    return data ?? []
  }

  // Fetch all tables in parallel — dependency order matters for import, not for export
  const [
    unit,
    allergen,
    ingredient,
    recipe,
  ] = await Promise.all([
    fetchTable('unit'),
    fetchTable('allergen'),
    fetchTable('ingredient'),
    fetchTable('recipe'),
  ])

  const recipe_component = await fetchComponents((recipe as any[]).map((r: any) => r.id))

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
    },
  }
})
