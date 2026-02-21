import { createError } from 'h3'
import type { H3Event } from 'h3'
import { requireUser } from './require-user'
import { supabaseAdmin } from './supabase'

export async function requireAnyPermission(event: H3Event, permissionCodes: string[]) {
  const user = await requireUser(event) // user.id is auth_user_id
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', user.id)
    .in('permission_code', permissionCodes)
    .limit(1)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data || data.length === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Missing permission',
    })
  }

  return user
}