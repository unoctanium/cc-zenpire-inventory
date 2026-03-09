import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { appUserId, clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()

  const [usersRes, rolesRes] = await Promise.all([
    admin
      .from('app_user')
      .select('id, email, first_name, last_name, telephone, is_active, created_at, user_role(role(id, code, name))')
      .eq('client_id', clientId)
      .neq('id', appUserId)
      .order('email'),
    admin
      .from('role')
      .select('id, code, name')
      .neq('code', 'superadmin')
      .order('name'),
  ])

  if (usersRes.error) throw createError({ statusCode: 500, statusMessage: usersRes.error.message })
  if (rolesRes.error) throw createError({ statusCode: 500, statusMessage: rolesRes.error.message })

  const users = (usersRes.data ?? []).map((u: any) => ({
    id:         u.id,
    email:      u.email,
    first_name: u.first_name ?? '',
    last_name:  u.last_name  ?? '',
    telephone:  u.telephone  ?? '',
    is_active:  u.is_active,
    created_at: u.created_at,
    roles:      (u.user_role ?? []).map((ur: any) => ur.role).filter(Boolean),
  }))

  return { ok: true, users, roles: rolesRes.data ?? [] }
})
