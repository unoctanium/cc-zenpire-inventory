import { createError } from 'h3'
import { supabaseAdmin, supabaseServer } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const sb = supabaseServer(event)
  const { data: userData, error: userErr } = await sb.auth.getUser()

  if (userErr || !userData?.user) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })
  }

  const authUserId = userData.user.id
  const admin      = supabaseAdmin()

  const { data: appUser, error: auErr } = await admin
    .from('app_user')
    .select('id, client_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (auErr) throw createError({ statusCode: 500, statusMessage: auErr.message })
  if (!appUser) throw createError({ statusCode: 403, statusMessage: 'No account found. Contact your administrator.' })

  const [permsRes, storesRes] = await Promise.all([
    admin.from('v_user_permissions').select('permission_code').eq('auth_user_id', authUserId),
    admin.from('store').select('id, name, address').eq('client_id', appUser.client_id).order('name'),
  ])

  if (permsRes.error) throw createError({ statusCode: 500, statusMessage: permsRes.error.message })

  const permissions = (permsRes.data ?? []).map((p) => p.permission_code).sort()

  return {
    ok:           true,
    email:        userData.user.email ?? null,
    app_user_id:  appUser.id,
    client_id:    appUser.client_id,
    permissions,
    is_admin:     permissions.includes('admin'),
    is_superadmin: permissions.includes('superadmin'),
    stores:       storesRes.data ?? [],
  }
})
