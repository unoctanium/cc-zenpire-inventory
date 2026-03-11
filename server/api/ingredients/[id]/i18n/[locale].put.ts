/**
 * PUT /api/ingredients/:id/i18n/:locale
 * Upserts a human-edited translation row for this ingredient and locale.
 * Sets is_machine=false, is_stale=false.
 */
import { createError, getRouterParam, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage'])
  const { clientId } = await resolveAppUser(event)

  const id     = getRouterParam(event, 'id')
  const locale = getRouterParam(event, 'locale')?.toLowerCase()
  if (!id || !locale) throw createError({ statusCode: 400, statusMessage: 'Missing id or locale' })

  const body = await readBody(event)
  const { name, comment } = body ?? {}

  const admin = supabaseAdmin()

  // Verify ingredient belongs to this client
  const { data: ing } = await admin
    .from('ingredient')
    .select('id')
    .eq('id', id)
    .eq('client_id', clientId)
    .single()
  if (!ing) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const { error } = await admin
    .from('ingredient_i18n')
    .upsert(
      {
        ingredient_id: id,
        locale,
        name:       name       ?? null,
        comment:    comment    ?? null,
        is_machine: false,
        is_stale:   false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ingredient_id,locale' },
    )

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
