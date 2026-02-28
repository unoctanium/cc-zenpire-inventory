import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')

  const admin = supabaseAdmin()

  const [usersRes, rolesRes] = await Promise.all([
    admin
      .from('app_user')
      .select('id, auth_user_id, email, display_name, is_active, created_at, user_role(role(id, code, name))')
      .order('email'),
    admin
      .from('role')
      .select('id, code, name')
      .order('name'),
  ])

  if (usersRes.error) throw createError({ statusCode: 500, statusMessage: usersRes.error.message })
  if (rolesRes.error) throw createError({ statusCode: 500, statusMessage: rolesRes.error.message })

  // Flatten nested user_role(role(*)) into roles: Role[]
  const users = (usersRes.data ?? []).map((u: any) => ({
    id:           u.id,
    auth_user_id: u.auth_user_id,
    email:        u.email,
    display_name: u.display_name,
    is_active:    u.is_active,
    created_at:   u.created_at,
    roles:        (u.user_role ?? []).map((ur: any) => ur.role).filter(Boolean),
  }))

  return { ok: true, users, roles: rolesRes.data ?? [] }
})
