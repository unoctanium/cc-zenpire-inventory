import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const recipe_id    = getRouterParam(event, 'id')
  const component_id = getRouterParam(event, 'componentId')
  if (!recipe_id || !component_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe id or component id' })
  }

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('recipe_component')
    .delete()
    .eq('id', component_id)
    .eq('recipe_id', recipe_id)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
