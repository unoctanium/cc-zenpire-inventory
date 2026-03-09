import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('ingredient')
    .update({ image_data: null, image_mime: null })
    .eq('id', id)
    .eq('client_id', clientId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
