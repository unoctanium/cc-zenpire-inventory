import { createError, sendRedirect, readFormData } from 'h3'
import { supabaseServer } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const form = await readFormData(event)
  const email = String(form.get('email') ?? '').trim()
  const password = String(form.get('password') ?? '').trim()

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Missing email or password' })
  }

  const supabase = supabaseServer(event)
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  const config = useRuntimeConfig()
  const base = config.public.siteUrl || ''

  if (error) {
    return sendRedirect(event, `${base}/login?err=${encodeURIComponent(error.message)}`, 303)
  }

  return sendRedirect(event, `${base}/`, 303)
})