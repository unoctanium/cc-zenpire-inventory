import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const { authUser, appUserId } = await resolveAppUser(event)
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('app_user')
    .select('email, first_name, last_name, telephone')
    .eq('id', appUserId)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return {
    ok:         true,
    email:      authUser.email ?? data.email,
    first_name: data.first_name ?? '',
    last_name:  data.last_name  ?? '',
    telephone:  data.telephone  ?? '',
  }
})
