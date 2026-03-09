import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const { clientId } = await resolveAppUser(event)

  const body    = await readBody(event)
  const name    = String(body?.name    ?? '').trim()
  const address = body?.address ? String(body.address).trim() || null : null

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('store')
    .insert({ client_id: clientId, name, address })
    .select('id, name, address, created_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, store: data }
})
