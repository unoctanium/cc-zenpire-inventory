import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body    = await readBody(event)
  const role_id = String(body?.role_id ?? '').trim()
  if (!role_id) throw createError({ statusCode: 400, statusMessage: 'Missing role_id' })

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('user_role')
    .insert({ user_id: id, role_id })

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
