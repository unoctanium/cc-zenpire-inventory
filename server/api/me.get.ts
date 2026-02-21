import { createError } from 'h3'
import { supabaseAdmin, supabaseServer } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  // ✅ session comes from Supabase SSR cookies
  const sb = supabaseServer(event)
  const { data: userData, error: userErr } = await sb.auth.getUser()

  if (userErr || !userData?.user) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })
  }

  const authUserId = userData.user.id
  const email = userData.user.email ?? null

  // ✅ DB work with service role
  const admin = supabaseAdmin()

  // ensure app_user exists
  const { data: existing, error: selErr } = await admin
    .from('app_user')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (selErr) throw createError({ statusCode: 500, statusMessage: selErr.message })

  let appUserId = existing?.id

  if (!appUserId) {
    const { data: created, error: insErr } = await admin
      .from('app_user')
      .insert({
        auth_user_id: authUserId,
        email: email ?? '(unknown)',
        display_name: email ?? '(unknown)',
        is_active: true,
      })
      .select('id')
      .single()

    if (insErr) throw createError({ statusCode: 500, statusMessage: insErr.message })
    appUserId = created.id
  }

  // permissions view
  const { data: perms, error: permErr } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', authUserId)

  if (permErr) throw createError({ statusCode: 500, statusMessage: permErr.message })

  return {
    ok: true,
    email,
    app_user_id: appUserId,
    permissions: (perms ?? []).map((p) => p.permission_code).sort(),
  }
})