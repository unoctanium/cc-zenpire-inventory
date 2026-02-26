import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['ingredient.manage', 'ingredient.read'])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()

  const { data: recipe, error: rErr } = await admin
    .from('recipe')
    .select(`
      id, name, description, output_quantity, output_unit_id,
      is_active, is_pre_product, created_at, updated_at,
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
      ingredient:ingredient_id ( name ),
      sub_recipe:sub_recipe_id ( name ),
      unit:unit_id ( code )
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

  const { data: media, error: mErr } = await admin
    .from('recipe_media')
    .select('id, recipe_id, storage_path, sort_order')
    .eq('recipe_id', id)
    .order('sort_order', { ascending: true })

  if (mErr) throw createError({ statusCode: 500, statusMessage: mErr.message })

  return {
    ok: true,
    recipe: {
      ...(recipe as any),
      output_unit_code: (recipe as any).unit?.code ?? '',
    },
    components: (components ?? []).map((c: any) => ({
      id:             c.id,
      recipe_id:      c.recipe_id,
      ingredient_id:  c.ingredient_id,
      sub_recipe_id:  c.sub_recipe_id,
      quantity:       c.quantity,
      unit_id:        c.unit_id,
      unit_code:      c.unit?.code ?? '',
      sort_order:     c.sort_order,
      type:           c.ingredient_id ? 'ingredient' : 'sub_recipe',
      name:           c.ingredient_id ? (c.ingredient?.name ?? '') : (c.sub_recipe?.name ?? ''),
    })),
    steps: steps ?? [],
    media: media ?? [],
  }
})
