/**
 * GET /api/ingredients/:id/i18n/:locale
 * Returns the existing translation row for this ingredient and locale,
 * or nulls if none exists yet.
 */
import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const id     = getRouterParam(event, 'id')
  const locale = getRouterParam(event, 'locale')?.toLowerCase()
  if (!id || !locale) throw createError({ statusCode: 400, statusMessage: 'Missing id or locale' })

  const admin = supabaseAdmin()

  // Verify ingredient belongs to this client
  const { data: ing } = await admin
    .from('ingredient')
    .select('id')
    .eq('id', id)
    .eq('client_id', clientId)
    .single()
  if (!ing) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const { data } = await admin
    .from('ingredient_i18n')
    .select('name, comment, is_machine, is_stale')
    .eq('ingredient_id', id)
    .eq('locale', locale)
    .single()

  return {
    ok:         true,
    name:       data?.name       ?? null,
    comment:    data?.comment    ?? null,
    is_machine: data?.is_machine ?? null,
    is_stale:   data?.is_stale   ?? null,
  }
})
