import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const recipe_id    = getRouterParam(event, 'id')
  const component_id = getRouterParam(event, 'componentId')
  if (!recipe_id || !component_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe id or component id' })
  }

  const admin = supabaseAdmin()

  // Verify recipe belongs to this client
  const { data: recipeCheck } = await admin
    .from('recipe').select('id').eq('id', recipe_id).eq('client_id', clientId).maybeSingle()
  if (!recipeCheck) throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })

  const { error } = await admin
    .from('recipe_component')
    .delete()
    .eq('id', component_id)
    .eq('recipe_id', recipe_id)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
