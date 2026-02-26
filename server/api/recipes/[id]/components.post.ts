import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ingredient.manage')

  const recipe_id = getRouterParam(event, 'id')
  if (!recipe_id) throw createError({ statusCode: 400, statusMessage: 'Missing recipe id' })

  const body = await readBody(event)
  const ingredient_id  = body?.ingredient_id  ? String(body.ingredient_id).trim()  : null
  const sub_recipe_id  = body?.sub_recipe_id  ? String(body.sub_recipe_id).trim()  : null
  const quantity       = Number(body?.quantity)
  const unit_id        = String(body?.unit_id ?? '').trim()
  const sort_order     = body?.sort_order != null ? Number(body.sort_order) : 0

  // XOR check
  if ((ingredient_id === null) === (sub_recipe_id === null)) {
    throw createError({ statusCode: 400, statusMessage: 'Exactly one of ingredient_id or sub_recipe_id must be set' })
  }
  if (!(quantity > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'quantity must be > 0' })
  }
  if (!unit_id) {
    throw createError({ statusCode: 400, statusMessage: 'unit_id is required' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe_component')
    .insert({ recipe_id, ingredient_id, sub_recipe_id, quantity, unit_id, sort_order })
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
