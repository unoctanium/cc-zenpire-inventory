import { getCookie } from 'h3'
import { supabaseAdmin, supabasePublishable } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const access = getCookie(event, 'sb-access-token')
  if (!access) throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })

  const sb = supabasePublishable()
  const { data: userData, error: userErr } = await sb.auth.getUser(access)
  if (userErr || !userData.user) throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })

  const authUserId = userData.user.id
  const email = userData.user.email ?? null

  const admin = supabaseAdmin()

  const { data: existing, error: selErr } = await admin
    .from('app_user')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (selErr) throw selErr

  let appUserId = existing?.id
  if (!appUserId) {
    const { data: created, error: insErr } = await admin
      .from('app_user')
      .insert({ auth_user_id: authUserId, email: email ?? '(unknown)', display_name: email, is_active: true })
      .select('id')
      .single()
    if (insErr) throw insErr
    appUserId = created.id
  }

  const { data: perms, error: permErr } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', authUserId)
  if (permErr) throw permErr

  return {
    ok: true,
    email,
    app_user_id: appUserId,
    permissions: (perms ?? []).map((p) => p.permission_code).sort(),
  }
})
