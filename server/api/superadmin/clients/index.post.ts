import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'superadmin')

  const body = await readBody(event)
  const name = String(body?.name ?? '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('client')
    .insert({ name })
    .select('id, name, created_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, client: data }
})
