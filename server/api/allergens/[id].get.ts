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
    .from('allergen')
    .select('id, name, code, comment')
    .eq('id', id)
    .eq('client_id', clientId)
    .single()

  if (error) throw createError({ statusCode: 404, statusMessage: error.message })
  return { ok: true, allergen: data }
})
