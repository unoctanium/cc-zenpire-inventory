import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')

  const id     = getRouterParam(event, 'id')
  const roleId = getRouterParam(event, 'roleId')
  if (!id || !roleId) throw createError({ statusCode: 400, statusMessage: 'Missing id or roleId' })

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('user_role')
    .delete()
    .eq('user_id', id)
    .eq('role_id', roleId)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
