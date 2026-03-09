import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const email      = String(body?.email      ?? '').trim().toLowerCase()
  const password   = String(body?.password   ?? '').trim()
  const first_name = String(body?.first_name ?? '').trim() || null
  const last_name  = String(body?.last_name  ?? '').trim() || null
  const telephone  = String(body?.telephone  ?? '').trim() || null
  const role_ids   = Array.isArray(body?.role_ids) ? body.role_ids as string[] : []

  if (!email)    throw createError({ statusCode: 400, statusMessage: 'Email is required.' })
  if (!password) throw createError({ statusCode: 400, statusMessage: 'Password is required.' })
  if (password.length < 6) throw createError({ statusCode: 400, statusMessage: 'Password must be at least 6 characters.' })

  const admin = supabaseAdmin()

  // 1. Create Supabase auth user
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr) throw createError({ statusCode: 400, statusMessage: authErr.message })

  const authUserId = authData.user.id

  // 2. Insert app_user
  const { data: appUser, error: auErr } = await admin
    .from('app_user')
    .insert({ auth_user_id: authUserId, email, first_name, last_name, telephone, client_id: clientId })
    .select('id, email, first_name, last_name, telephone, is_active, created_at')
    .single()

  if (auErr) {
    // Roll back auth user if app_user insert fails
    await admin.auth.admin.deleteUser(authUserId)
    throw createError({ statusCode: 500, statusMessage: auErr.message })
  }

  // 3. Assign roles
  if (role_ids.length) {
    const roleRows = role_ids.map(role_id => ({ user_id: appUser.id, role_id }))
    const { error: roleErr } = await admin.from('user_role').insert(roleRows)
    if (roleErr) throw createError({ statusCode: 500, statusMessage: roleErr.message })
  }

  return { ok: true, user: { ...appUser, roles: [] } }
})
