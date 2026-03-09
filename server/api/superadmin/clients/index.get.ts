import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'superadmin')

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('client')
    .select('id, name, created_at')
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, clients: data ?? [] }
})
