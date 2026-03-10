import { supabaseAdmin } from '~/server/utils/supabase'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  const { appUserId } = await resolveAppUser(event)
  const admin = supabaseAdmin()

  const { error } = await admin
    .from('app_user')
    .update({ avatar_data: null, avatar_mime: null })
    .eq('id', appUserId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
