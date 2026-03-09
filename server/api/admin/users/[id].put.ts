import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const id   = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody(event)
  const first_name = String(body?.first_name ?? '').trim() || null
  const last_name  = String(body?.last_name  ?? '').trim() || null
  const telephone  = String(body?.telephone  ?? '').trim() || null
  const password   = String(body?.password   ?? '').trim() || null
  const role_ids   = Array.isArray(body?.role_ids) ? body.role_ids as string[] : []

  const admin = supabaseAdmin()

  // Verify user belongs to this client and get auth_user_id
  const { data: appUser, error: fetchErr } = await admin
    .from('app_user')
    .select('id, auth_user_id')
    .eq('id', id)
    .eq('client_id', clientId)
    .single()

  if (fetchErr || !appUser) throw createError({ statusCode: 404, statusMessage: 'User not found.' })

  // Update profile
  const { error: upErr } = await admin
    .from('app_user')
    .update({ first_name, last_name, telephone })
    .eq('id', id)

  if (upErr) throw createError({ statusCode: 500, statusMessage: upErr.message })

  // Update password if provided
  if (password) {
    if (password.length < 6) throw createError({ statusCode: 400, statusMessage: 'Password must be at least 6 characters.' })
    const { error: pwErr } = await admin.auth.admin.updateUserById(appUser.auth_user_id, { password })
    if (pwErr) throw createError({ statusCode: 500, statusMessage: pwErr.message })
  }

  // Sync roles: replace all
  await admin.from('user_role').delete().eq('user_id', id)
  if (role_ids.length) {
    const roleRows = role_ids.map(role_id => ({ user_id: id, role_id }))
    const { error: roleErr } = await admin.from('user_role').insert(roleRows)
    if (roleErr) throw createError({ statusCode: 500, statusMessage: roleErr.message })
  }

  return { ok: true }
})
