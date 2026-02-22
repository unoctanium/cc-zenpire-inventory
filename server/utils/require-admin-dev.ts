import { supabaseAdmin, supabaseServer } from '~/server/utils/supabase'

export async function requireAdminDev(event: any) {
  const config = useRuntimeConfig()
  if (!config.devMode) {
    throw createError({ statusCode: 403, statusMessage: 'DEV_MODE disabled' })
  }

  // Use supabaseServer (SSR cookie-based) — consistent with all other routes
  const sb = supabaseServer(event)
  const { data: userData, error: userErr } = await sb.auth.getUser()

  if (userErr || !userData?.user) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })
  }

  const admin = supabaseAdmin()

  // MVP gate: require stock.adjust.post as proxy for "admin"
  const { data: perms, error: permErr } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', userData.user.id)

  if (permErr) throw createError({ statusCode: 500, statusMessage: permErr.message })

  const has = new Set((perms ?? []).map((p: any) => p.permission_code))
  if (!has.has('stock.adjust.post')) {
    throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })
  }

  const { data: au, error: auErr } = await admin
    .from('app_user')
    .select('id')
    .eq('auth_user_id', userData.user.id)
    .single()

  if (auErr || !au) {
    throw createError({ statusCode: 500, statusMessage: 'Could not resolve app_user' })
  }

  return { admin, appUserId: au.id as string }
}