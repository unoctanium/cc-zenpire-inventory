import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['ingredient.manage', 'ingredient.read'])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ingredient')
    .select(`
      id,
      name,
      kind,
      default_unit_id,
      standard_unit_cost,
      standard_cost_currency,
      produced_by_recipe_id,
      unit:default_unit_id ( code )
    `)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return {
    ok: true,
    ingredients: (data ?? []).map((r: any) => ({
      id:                    r.id,
      name:                  r.name,
      kind:                  r.kind,
      default_unit_id:       r.default_unit_id,
      default_unit_code:     r.unit?.code ?? '',
      standard_unit_cost:    r.standard_unit_cost,
      standard_cost_currency: r.standard_cost_currency ?? 'EUR',
      produced_by_recipe_id: r.produced_by_recipe_id,
    })),
  }
})
