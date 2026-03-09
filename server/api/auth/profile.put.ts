import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const { appUserId } = await resolveAppUser(event)
  const body = await readBody(event)

  const first_name = (body.first_name ?? '').trim() || null
  const last_name  = (body.last_name  ?? '').trim() || null
  const telephone  = (body.telephone  ?? '').trim() || null

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('app_user')
    .update({ first_name, last_name, telephone })
    .eq('id', appUserId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
