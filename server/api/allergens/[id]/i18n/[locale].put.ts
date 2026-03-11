/**
 * PUT /api/allergens/:id/i18n/:locale
 * Upserts a human-edited translation row for this allergen and locale.
 * Sets is_machine=false, is_stale=false.
 */
import { createError, getRouterParam, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const id     = getRouterParam(event, 'id')
  const locale = getRouterParam(event, 'locale')?.toLowerCase()
  if (!id || !locale) throw createError({ statusCode: 400, statusMessage: 'Missing id or locale' })

  // Verify allergen belongs to client
  const admin = supabaseAdmin()
  const { error: ownerErr } = await admin
    .from('allergen').select('id').eq('id', id).eq('client_id', clientId).single()
  if (ownerErr) throw createError({ statusCode: 404, statusMessage: 'Allergen not found' })

  const body    = await readBody(event)
  const name    = body?.name    !== undefined ? (String(body.name).trim() || null) : undefined
  const comment = body?.comment !== undefined ? (String(body.comment).trim() || null) : undefined

  const { error } = await admin
    .from('allergen_i18n')
    .upsert(
      {
        allergen_id: id,
        locale,
        name:        name    ?? null,
        comment:     comment ?? null,
        is_machine:  false,
        is_stale:    false,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'allergen_id,locale' },
    )

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
