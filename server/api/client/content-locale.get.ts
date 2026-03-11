/**
 * GET /api/client/content-locale
 * Returns the client's content source locale.
 * Requires any authenticated user (not admin-only).
 */
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireUser } from '~/server/utils/require-user'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('client')
    .select('content_locale')
    .eq('id', clientId)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, content_locale: data.content_locale ?? 'de' }
})
