import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const body = await readBody(event)
  const name            = String(body?.name            ?? '').trim()
  const default_unit_id = String(body?.default_unit_id ?? '').trim()
  const standard_unit_cost = body?.standard_unit_cost != null
    ? Number(body.standard_unit_cost)
    : null
  const comment      = body?.comment != null ? String(body.comment).trim() || null : null
  const allergen_ids = Array.isArray(body?.allergen_ids) ? (body.allergen_ids as string[]) : []

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
      comment,
    })
    .select('id, name, kind, default_unit_id, standard_unit_cost, standard_cost_currency, comment')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  if (allergen_ids.length > 0) {
    await admin.from('ingredient_allergen')
      .insert(allergen_ids.map(aid => ({ ingredient_id: data.id, allergen_id: aid })))
  }

  return { ok: true, ingredient: data }
})
