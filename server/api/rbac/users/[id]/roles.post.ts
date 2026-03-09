import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body    = await readBody(event)
  const role_id = String(body?.role_id ?? '').trim()
  if (!role_id) throw createError({ statusCode: 400, statusMessage: 'Missing role_id' })

  const admin = supabaseAdmin()

  // Verify target user belongs to this client
  const { data: userCheck } = await admin
    .from('app_user').select('id').eq('id', id).eq('client_id', clientId).maybeSingle()
  if (!userCheck) throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })

  const { error } = await admin
    .from('user_role')
    .insert({ user_id: id, role_id })

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
