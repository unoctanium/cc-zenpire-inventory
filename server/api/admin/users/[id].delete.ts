import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()

  // Verify user belongs to this client and get auth_user_id
  const { data: appUser, error: fetchErr } = await admin
    .from('app_user')
    .select('id, auth_user_id')
    .eq('id', id)
    .eq('client_id', clientId)
    .single()

  if (fetchErr || !appUser) throw createError({ statusCode: 404, statusMessage: 'User not found.' })

  // Delete app_user (cascades user_role)
  const { error: delErr } = await admin.from('app_user').delete().eq('id', id)
  if (delErr) throw createError({ statusCode: 500, statusMessage: delErr.message })

  // Delete Supabase auth user
  const { error: authErr } = await admin.auth.admin.deleteUser(appUser.auth_user_id)
  if (authErr) throw createError({ statusCode: 500, statusMessage: authErr.message })

  return { ok: true }
})
