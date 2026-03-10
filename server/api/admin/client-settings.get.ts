/**
 * GET /api/admin/client-settings
 * Returns current client settings (content_locale).
 */
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('client')
    .select('content_locale')
    .eq('id', clientId)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, content_locale: data.content_locale }
})
