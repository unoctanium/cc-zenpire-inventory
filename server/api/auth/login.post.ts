import { createError, readBody } from 'h3'
import { supabaseServer } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const body     = await readBody(event)
  const email    = String(body?.email    ?? '').trim()
  const password = String(body?.password ?? '').trim()

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Missing email or password' })
  }

  const supabase = supabaseServer(event)
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw createError({ statusCode: 401, statusMessage: error.message })
  }

  return { ok: true }
})
