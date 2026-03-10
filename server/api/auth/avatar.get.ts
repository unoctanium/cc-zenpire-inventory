import { setResponseHeader } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  const { appUserId } = await resolveAppUser(event)
  const admin = supabaseAdmin()

  const { data, error } = await admin
    .from('app_user')
    .select('avatar_data, avatar_mime')
    .eq('id', appUserId)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data?.avatar_data) throw createError({ statusCode: 404, statusMessage: 'No avatar' })

  setResponseHeader(event, 'Content-Type', data.avatar_mime ?? 'image/jpeg')
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
  return Buffer.from(data.avatar_data, 'base64')
})
