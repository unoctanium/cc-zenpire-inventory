import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()

  const { data: recipe, error: rErr } = await admin
    .from('recipe')
    .select(`
      id, name, description, output_quantity, output_unit_id,
      standard_unit_cost, is_active, is_pre_product, created_at, updated_at,
      image_data,
      unit:output_unit_id ( code )
    `)
    .eq('id', id)
    .single()

  if (rErr) throw createError({ statusCode: 404, statusMessage: rErr.message })

  const { data: components, error: cErr } = await admin
    .from('recipe_component')
    .select(`
      id, recipe_id, ingredient_id, sub_recipe_id,
      quantity, unit_id, sort_order,
      ingredient:ingredient_id (
        name, standard_unit_cost,
        default_unit:default_unit_id ( factor )
      ),
      sub_recipe:sub_recipe_id (
        name, standard_unit_cost,
        output_unit:output_unit_id ( factor )
      ),
      unit:unit_id ( code, factor )
    `)
    .eq('recipe_id', id)
    .order('sort_order', { ascending: true })

  if (cErr) throw createError({ statusCode: 500, statusMessage: cErr.message })

  const { data: steps, error: sErr } = await admin
    .from('recipe_step')
    .select('recipe_id, step_no, instruction_text')
    .eq('recipe_id', id)
    .order('step_no', { ascending: true })

  if (sErr) throw createError({ statusCode: 500, statusMessage: sErr.message })

  return {
    ok: true,
    recipe: {
      ...(recipe as any),
      output_unit_code: (recipe as any).unit?.code ?? '',
      has_image:        !!(recipe as any).image_data,
      image_data:       undefined,
    },
    components: (components ?? []).map((c: any) => ({
      id:                   c.id,
      recipe_id:            c.recipe_id,
      ingredient_id:        c.ingredient_id,
      sub_recipe_id:        c.sub_recipe_id,
      quantity:             c.quantity,
      unit_id:              c.unit_id,
      unit_code:            c.unit?.code ?? '',
      sort_order:           c.sort_order,
      type:                 c.ingredient_id ? 'ingredient' : 'sub_recipe',
      name:                 c.ingredient_id ? (c.ingredient?.name ?? '') : (c.sub_recipe?.name ?? ''),
      std_cost:             c.ingredient_id
                              ? (c.ingredient?.standard_unit_cost ?? null)
                              : (c.sub_recipe?.standard_unit_cost ?? null),
      base_unit_factor:     c.ingredient_id
                              ? (c.ingredient?.default_unit?.factor ?? null)
                              : (c.sub_recipe?.output_unit?.factor ?? null),
      component_unit_factor: c.unit?.factor ?? null,
    })),
    steps: steps ?? [],
  }
})
