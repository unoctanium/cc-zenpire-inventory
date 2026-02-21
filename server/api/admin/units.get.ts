import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/require-user'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('unit')
    .select('id, code, name, unit_type')
    .order('unit_type', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, units: data ?? [] }
})