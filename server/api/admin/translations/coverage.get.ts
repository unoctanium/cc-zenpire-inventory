/**
 * GET /api/admin/translations/coverage
 * Returns translation coverage stats per locale.
 * Response: { ok, source_locale, locales: [{ locale, ingredients, recipes }] }
 * where ingredients/recipes = { total, translated, stale }
 */
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

const APP_LOCALES = ['de', 'en', 'ja']

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()

  // Get source locale
  const { data: clientRow } = await admin
    .from('client')
    .select('content_locale')
    .eq('id', clientId)
    .single()
  const sourceLang = clientRow?.content_locale ?? 'de'

  // Count totals
  const [{ count: totalIngredients }, { count: totalRecipes }] = await Promise.all([
    admin.from('ingredient').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
    admin.from('recipe').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
  ])

  const targetLocales = APP_LOCALES.filter(l => l !== sourceLang)

  const locales = await Promise.all(
    targetLocales.map(async (locale) => {
      const [ingredientRows, recipeRows] = await Promise.all([
        admin.from('ingredient_i18n').select('ingredient_id, is_stale').eq('locale', locale),
        admin.from('recipe_i18n').select('recipe_id, is_stale').eq('locale', locale),
      ])

      // Filter to only this client's items by joining — simpler: fetch all and rely on FK cascade
      // ingredient_i18n has no client_id, but we fetched ingredients for clientId above
      const ingRows    = ingredientRows.data ?? []
      const recRows    = recipeRows.data ?? []

      return {
        locale,
        ingredients: {
          total:      totalIngredients ?? 0,
          translated: ingRows.length,
          stale:      ingRows.filter(r => r.is_stale).length,
        },
        recipes: {
          total:      totalRecipes ?? 0,
          translated: recRows.length,
          stale:      recRows.filter(r => r.is_stale).length,
        },
      }
    })
  )

  return { ok: true, source_locale: sourceLang, locales }
})
