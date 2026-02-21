import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireUser } from './require-user'
import { supabaseAdmin } from './supabase'

export async function requirePermission(event: H3Event, permissionCode: string) {
  const user = await requireUser(event) // user.id is auth_user_id
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', user.id)
    .eq('permission_code', permissionCode)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 403, statusMessage: 'Missing permission' })

  return user
}