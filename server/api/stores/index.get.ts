import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('store')
    .select('id, name, address, created_at')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, stores: data ?? [] }
})
