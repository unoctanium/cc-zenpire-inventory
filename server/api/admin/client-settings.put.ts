/**
 * PUT /api/admin/client-settings
 * Update client settings (content_locale).
 * Body: { content_locale: string }
 */
import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

const ALLOWED_LOCALES = ['de', 'en', 'ja']

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const content_locale = String(body?.content_locale ?? '').trim().toLowerCase()

  if (!ALLOWED_LOCALES.includes(content_locale)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid locale. Allowed: ${ALLOWED_LOCALES.join(', ')}` })
  }

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('client')
    .update({ content_locale })
    .eq('id', clientId)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, content_locale }
})
