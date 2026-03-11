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
 *     unit, allergen, ingredient, recipe, recipe_component,
 *     ingredient_i18n, recipe_i18n
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

  // i18n and join tables have no client_id — fetch via parent IDs
  async function fetchByParent(table: string, parentCol: string, parentIds: string[]) {
    if (parentIds.length === 0) return []
    const { data, error } = await admin.from(table).select('*').in(parentCol, parentIds)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Export failed on table ${table}: ${error.message}` })
    }
    return data ?? []
  }

  // Fetch all client-scoped tables in parallel
  const [unit, allergen, ingredient, recipe] = await Promise.all([
    fetchTable('unit'),
    fetchTable('allergen'),
    fetchTable('ingredient'),
    fetchTable('recipe'),
  ])

  const allergenIds   = (allergen    as any[]).map((r: any) => r.id)
  const ingredientIds = (ingredient as any[]).map((r: any) => r.id)
  const recipeIds     = (recipe     as any[]).map((r: any) => r.id)

  const [allergen_i18n, ingredient_i18n, recipe_i18n, recipe_component] = await Promise.all([
    fetchByParent('allergen_i18n',   'allergen_id',   allergenIds),
    fetchByParent('ingredient_i18n', 'ingredient_id', ingredientIds),
    fetchByParent('recipe_i18n',     'recipe_id',     recipeIds),
    fetchByParent('recipe_component','recipe_id',     recipeIds),
  ])

  return {
    version:     1,
    app:         'zenpire-inventory',
    exported_at: new Date().toISOString(),
    tables: {
      // Dependency order (safe insert sequence for import):
      // 1. No-dependency reference tables
      unit,
      allergen,
      // 2. ingredient depends on unit; produced_by_recipe_id nulled → patched after recipes
      ingredient,
      // 3. recipe depends on unit (output_unit_id)
      recipe,
      // 4. join/child tables
      recipe_component,
      // 5. translation rows (depend on allergen/ingredient/recipe)
      allergen_i18n,
      ingredient_i18n,
      recipe_i18n,
    },
  }
})
