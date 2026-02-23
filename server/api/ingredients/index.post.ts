import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ingredient.manage')

  const body = await readBody(event)
  const name            = String(body?.name            ?? '').trim()
  const default_unit_id = String(body?.default_unit_id ?? '').trim()
  const standard_unit_cost = body?.standard_unit_cost != null
    ? Number(body.standard_unit_cost)
    : null

  if (!name || !default_unit_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name or default_unit_id' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ingredient')
    .insert({
      name,
      default_unit_id,
      kind: 'purchased',
      standard_unit_cost,
      standard_cost_currency: 'EUR',
    })
    .select('id, name, kind, default_unit_id, standard_unit_cost, standard_cost_currency')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, ingredient: data }
})
