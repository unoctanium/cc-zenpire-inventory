import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { supabaseAdmin } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const { authUser } = await resolveAppUser(event)
  const body = await readBody(event)

  const password = (body.password ?? '').trim()
  if (!password || password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Password must be at least 6 characters.' })
  }

  const admin = supabaseAdmin()
  const { error } = await admin.auth.admin.updateUserById(authUser.id, { password })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
