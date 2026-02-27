import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ingredient')
    .select(`
      id, name, kind, default_unit_id, standard_unit_cost,
      standard_cost_currency, produced_by_recipe_id, comment,
      unit:default_unit_id ( code ),
      ingredient_allergen ( allergen_id )
    `)
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 404, statusMessage: error.message })

  return {
    ok: true,
    ingredient: {
      id:                     data.id,
      name:                   data.name,
      kind:                   data.kind,
      default_unit_id:        data.default_unit_id,
      default_unit_code:      (data as any).unit?.code ?? '',
      standard_unit_cost:     data.standard_unit_cost,
      standard_cost_currency: data.standard_cost_currency ?? 'EUR',
      produced_by_recipe_id:  data.produced_by_recipe_id,
      comment:                data.comment ?? null,
      allergen_ids:           ((data as any).ingredient_allergen ?? []).map((ia: any) => ia.allergen_id),
    },
  }
})
