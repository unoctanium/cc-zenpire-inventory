import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['ingredient.manage', 'ingredient.read'])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .select(`
      id,
      name,
      description,
      output_quantity,
      output_unit_id,
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

  if (ids.length > 0) {
    const { data: comps } = await admin
      .from('recipe_component')
      .select('recipe_id')
      .in('recipe_id', ids)

    for (const c of comps ?? []) {
      countMap.set(c.recipe_id, (countMap.get(c.recipe_id) ?? 0) + 1)
    }
  }

  return {
    ok: true,
    recipes: (data ?? []).map((r: any) => ({
      id:               r.id,
      name:             r.name,
      description:      r.description ?? '',
      output_quantity:  r.output_quantity,
      output_unit_id:   r.output_unit_id,
      output_unit_code: r.unit?.code ?? '',
      is_active:        r.is_active,
      is_pre_product:   r.is_pre_product,
      component_count:  countMap.get(r.id) ?? 0,
      created_at:       r.created_at,
      updated_at:       r.updated_at,
    })),
  }
})
