import { setCookie } from 'h3'
import { supabasePublishable } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string; password: string }>(event)
  const sb = supabasePublishable()

  const { data, error } = await sb.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  })

  if (error || !data.session) {
    throw createError({ statusCode: 401, statusMessage: error?.message ?? 'Login failed' })
  }

  // Store tokens in httpOnly cookies (MVP)
  setCookie(event, 'sb-access-token', data.session.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })
  setCookie(event, 'sb-refresh-token', data.session.refresh_token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  return { ok: true }
})