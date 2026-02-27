import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .select(`
      id,
      name,
      description,
      output_quantity,
      output_unit_id,
      standard_unit_cost,
      is_active,
      is_pre_product,
      created_at,
      updated_at,
      unit:output_unit_id ( code )
    `)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Fetch component counts separately
  const ids = (data ?? []).map((r: any) => r.id)
  const countMap = new Map<string, number>()

  const costMap = new Map<string, number | null>()

  if (ids.length > 0) {
    const { data: comps } = await admin
      .from('recipe_component')
      .select('recipe_id')
      .in('recipe_id', ids)

    for (const c of comps ?? []) {
      countMap.set(c.recipe_id, (countMap.get(c.recipe_id) ?? 0) + 1)
    }

    const { data: costs } = await admin
      .from('v_recipe_comp_cost')
      .select('recipe_id, comp_cost')
      .in('recipe_id', ids)

    for (const c of costs ?? []) {
      costMap.set((c as any).recipe_id, (c as any).comp_cost ?? null)
    }
  }

  return {
    ok: true,
    recipes: (data ?? []).map((r: any) => ({
      id:                 r.id,
      name:               r.name,
      description:        r.description ?? '',
      output_quantity:    r.output_quantity,
      output_unit_id:     r.output_unit_id,
      output_unit_code:   r.unit?.code ?? '',
      standard_unit_cost: r.standard_unit_cost ?? null,
      is_active:          r.is_active,
      is_pre_product:     r.is_pre_product,
      component_count:    countMap.get(r.id) ?? 0,
      comp_cost:          costMap.get(r.id) ?? null,
      created_at:         r.created_at,
      updated_at:         r.updated_at,
    })),
  }
})
