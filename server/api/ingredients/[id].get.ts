import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ingredient')
    .select(`
      id, article_id, name, kind, default_unit_id, standard_unit_cost,
      standard_cost_currency, produced_by_recipe_id, comment, name_translation_locked,
      image_data,
      yield_pct,
      purchase_quantity, purchase_unit_id, purchase_price, purchase_price_currency,
      unit:default_unit_id ( code, unit_type ),
      purchase_unit:purchase_unit_id ( code, unit_type ),
      ingredient_allergen ( allergen_id )
    `)
    .eq('id', id)
    .eq('client_id', clientId)
    .single()

  if (error) throw createError({ statusCode: 404, statusMessage: error.message })

  // For produced ingredients, resolve allergens from the full recursive recipe tree.
  // For purchased ingredients, use the direct ingredient_allergen entries.
  let allergenIds: string[]
  if (data.kind === 'produced' && data.produced_by_recipe_id) {
    const { data: effData } = await admin
      .from('v_recipe_effective_allergens')
      .select('allergen_id')
      .eq('recipe_id', data.produced_by_recipe_id)
    allergenIds = (effData ?? []).map((r: any) => r.allergen_id)
  } else {
    allergenIds = ((data as any).ingredient_allergen ?? []).map((ia: any) => ia.allergen_id)
  }

  return {
    ok: true,
    ingredient: {
      id:                      data.id,
      article_id:              (data as any).article_id ?? null,
      name:                    data.name,
      kind:                    data.kind,
      default_unit_id:         data.default_unit_id,
      default_unit_code:       (data as any).unit?.code ?? '',
      default_unit_type:       (data as any).unit?.unit_type ?? 'count',
      standard_unit_cost:      data.standard_unit_cost,
      standard_cost_currency:  data.standard_cost_currency ?? 'EUR',
      produced_by_recipe_id:   data.produced_by_recipe_id,
      comment:                 data.comment ?? null,
      has_image:                  !!data.image_data,
      allergen_ids:               allergenIds,
      name_translation_locked:    (data as any).name_translation_locked ?? false,
      yield_pct:               (data as any).yield_pct ?? 100,
      purchase_quantity:       (data as any).purchase_quantity ?? null,
      purchase_unit_id:        (data as any).purchase_unit_id ?? null,
      purchase_unit_code:      (data as any).purchase_unit?.code ?? null,
      purchase_price:          (data as any).purchase_price ?? null,
      purchase_price_currency: (data as any).purchase_price_currency ?? 'EUR',
    },
  }
})
