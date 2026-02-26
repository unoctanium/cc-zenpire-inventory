import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const recipe_id    = getRouterParam(event, 'id')
  const component_id = getRouterParam(event, 'componentId')
  if (!recipe_id || !component_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe id or component id' })
  }

  const body     = await readBody(event)
  const quantity = Number(body?.quantity)
  const unit_id  = String(body?.unit_id ?? '').trim()

  if (!(quantity > 0)) throw createError({ statusCode: 400, statusMessage: 'quantity must be > 0' })
  if (!unit_id)        throw createError({ statusCode: 400, statusMessage: 'unit_id is required' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe_component')
    .update({ quantity, unit_id })
    .eq('id', component_id)
    .eq('recipe_id', recipe_id)
    .select(`
      id, recipe_id, ingredient_id, sub_recipe_id, quantity, unit_id, sort_order,
      ingredient:ingredient_id ( name ),
      sub_recipe:sub_recipe_id ( name ),
      unit:unit_id ( code )
    `)
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  const c = data as any
  return {
    ok: true,
    component: {
      id:            c.id,
      recipe_id:     c.recipe_id,
      ingredient_id: c.ingredient_id,
      sub_recipe_id: c.sub_recipe_id,
      quantity:      c.quantity,
      unit_id:       c.unit_id,
      unit_code:     c.unit?.code ?? '',
      sort_order:    c.sort_order,
      type:          c.ingredient_id ? 'ingredient' : 'sub_recipe',
      name:          c.ingredient_id ? (c.ingredient?.name ?? '') : (c.sub_recipe?.name ?? ''),
    },
  }
})
