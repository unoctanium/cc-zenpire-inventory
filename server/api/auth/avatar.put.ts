import { readMultipartFormData } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  const { appUserId } = await resolveAppUser(event)

  const parts = await readMultipartFormData(event)
  const file  = parts?.find(p => p.name === 'avatar')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'No image provided' })

  const mime   = file.type ?? 'image/jpeg'
  const base64 = Buffer.from(file.data).toString('base64')

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('app_user')
    .update({ avatar_data: base64, avatar_mime: mime })
    .eq('id', appUserId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
