import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody(event)
  const name            = String(body?.name            ?? '').trim()
  const default_unit_id = String(body?.default_unit_id ?? '').trim()
  const standard_unit_cost = body?.standard_unit_cost != null && body.standard_unit_cost !== ''
    ? Number(body.standard_unit_cost)
    : null

  if (!name || !default_unit_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name or default_unit_id' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('ingredient')
    .update({ name, default_unit_id, standard_unit_cost })
    .eq('id', id)
    .select('id, name, kind, default_unit_id, standard_unit_cost, standard_cost_currency')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, ingredient: data }
})
