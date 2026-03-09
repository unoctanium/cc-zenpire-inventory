import { createError } from 'h3'
import type { H3Event } from 'h3'
import { supabaseAdmin } from './supabase'
import { requireUser } from './require-user'

/**
 * Resolves the authenticated app_user and their client_id.
 * Throws 401 if unauthenticated, 403 if no app_user record exists.
 */
export async function resolveAppUser(event: H3Event) {
  const authUser = await requireUser(event)
  const admin    = supabaseAdmin()

  const { data: appUser, error } = await admin
    .from('app_user')
    .select('id, client_id')
    .eq('auth_user_id', authUser.id)
    .single()

  if (error || !appUser) {
    throw createError({ statusCode: 403, statusMessage: 'No account found. Contact your administrator.' })
  }

  return {
    authUser,
    appUserId: appUser.id as string,
    clientId:  appUser.client_id as string,
  }
}
