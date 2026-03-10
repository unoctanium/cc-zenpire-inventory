import { createError, getQuery } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const query = getQuery(event)
  const requestedLocale = query.locale ? String(query.locale).toLowerCase() : null

  const admin = supabaseAdmin()

  // Get client source locale (only needed when a locale is requested)
  let sourceLang = 'de'
  if (requestedLocale) {
    const { data: clientRow } = await admin.from('client').select('content_locale').eq('id', clientId).single()
    sourceLang = clientRow?.content_locale ?? 'de'
  }

  const { data, error } = await admin
    .from('ingredient')
    .select(`
      id,
      article_id,
      name,
      kind,
      default_unit_id,
      standard_unit_cost,
      standard_cost_currency,
      produced_by_recipe_id,
      comment,
      yield_pct,
      purchase_quantity,
      purchase_unit_id,
      purchase_price,
      purchase_price_currency,
      unit:default_unit_id ( code, unit_type ),
      purchase_unit:purchase_unit_id ( code, unit_type )
    `)
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Fetch translations when locale differs from source
  const i18nMap = new Map<string, { name: string | null; comment: string | null; is_machine: boolean }>()
  if (requestedLocale && requestedLocale !== sourceLang && (data ?? []).length > 0) {
    const ids = (data ?? []).map((r: any) => r.id)
    const { data: i18nRows } = await admin
      .from('ingredient_i18n')
      .select('ingredient_id, name, comment, is_machine')
      .eq('locale', requestedLocale)
      .in('ingredient_id', ids)
    for (const row of i18nRows ?? []) {
      i18nMap.set(row.ingredient_id, { name: row.name, comment: row.comment, is_machine: row.is_machine })
    }
  }

  return {
    ok: true,
    ingredients: (data ?? []).map((r: any) => {
      const t = i18nMap.get(r.id)
      return {
        id:                      r.id,
        article_id:              r.article_id ?? null,
        name:                    (t?.name) || r.name,
        kind:                    r.kind,
        default_unit_id:         r.default_unit_id,
        default_unit_code:       r.unit?.code ?? '',
        default_unit_type:       r.unit?.unit_type ?? 'count',
        standard_unit_cost:      r.standard_unit_cost,
        standard_cost_currency:  r.standard_cost_currency ?? 'EUR',
        produced_by_recipe_id:   r.produced_by_recipe_id,
        comment:                 (t?.comment !== undefined ? t?.comment : r.comment) ?? null,
        yield_pct:               r.yield_pct ?? 100,
        purchase_quantity:       r.purchase_quantity ?? null,
        purchase_unit_id:        r.purchase_unit_id ?? null,
        purchase_unit_code:      r.purchase_unit?.code ?? null,
        purchase_price:          r.purchase_price ?? null,
        purchase_price_currency: r.purchase_price_currency ?? 'EUR',
        is_machine_translation:  t ? t.is_machine : false,
      }
    }),
  }
})
