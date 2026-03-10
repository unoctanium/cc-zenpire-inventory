import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()
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

  return {
    ok: true,
    ingredients: (data ?? []).map((r: any) => ({
      id:                      r.id,
      article_id:              r.article_id ?? null,
      name:                    r.name,
      kind:                    r.kind,
      default_unit_id:         r.default_unit_id,
      default_unit_code:       r.unit?.code ?? '',
      default_unit_type:       r.unit?.unit_type ?? 'count',
      standard_unit_cost:      r.standard_unit_cost,
      standard_cost_currency:  r.standard_cost_currency ?? 'EUR',
      produced_by_recipe_id:   r.produced_by_recipe_id,
      comment:                 r.comment ?? null,
      yield_pct:               r.yield_pct ?? 100,
      purchase_quantity:       r.purchase_quantity ?? null,
      purchase_unit_id:        r.purchase_unit_id ?? null,
      purchase_unit_code:      r.purchase_unit?.code ?? null,
      purchase_price:          r.purchase_price ?? null,
      purchase_price_currency: r.purchase_price_currency ?? 'EUR',
    })),
  }
})
