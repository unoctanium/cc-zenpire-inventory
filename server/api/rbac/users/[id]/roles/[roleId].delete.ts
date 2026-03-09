import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const id     = getRouterParam(event, 'id')
  const roleId = getRouterParam(event, 'roleId')
  if (!id || !roleId) throw createError({ statusCode: 400, statusMessage: 'Missing id or roleId' })

  const admin = supabaseAdmin()

  // Verify target user belongs to this client
  const { data: userCheck } = await admin
    .from('app_user').select('id').eq('id', id).eq('client_id', clientId).maybeSingle()
  if (!userCheck) throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })

  const { error } = await admin
    .from('user_role')
    .delete()
    .eq('user_id', id)
    .eq('role_id', roleId)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
