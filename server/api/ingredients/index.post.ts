import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const name            = String(body?.name            ?? '').trim()
  const article_id      = String(body?.article_id      ?? '').trim() || null
  const default_unit_id = String(body?.default_unit_id ?? '').trim()
  const comment      = body?.comment != null ? String(body.comment).trim() || null : null
  const allergen_ids = Array.isArray(body?.allergen_ids) ? (body.allergen_ids as string[]) : []

  const purchase_quantity = body?.purchase_quantity != null && body.purchase_quantity !== '' ? Number(body.purchase_quantity) : null
  const purchase_unit_id  = body?.purchase_unit_id  ? String(body.purchase_unit_id).trim() || null : null
  const purchase_price    = body?.purchase_price    != null && body.purchase_price !== '' ? Number(body.purchase_price) : null
  const yield_pct         = body?.yield_pct != null && body.yield_pct !== '' ? Number(body.yield_pct) : 100

  if (!name || !default_unit_id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name or default_unit_id' })
  }

  const admin = supabaseAdmin()

  // Derive standard_unit_cost from purchase fields when all three are provided
  let standard_unit_cost: number | null = body?.standard_unit_cost != null && body.standard_unit_cost !== ''
    ? Number(body.standard_unit_cost)
    : null
  if (purchase_quantity && purchase_unit_id && purchase_price != null) {
    const { data: unitRow } = await admin.from('unit').select('factor').eq('id', purchase_unit_id).single()
    if (unitRow?.factor) {
      standard_unit_cost = purchase_price / (purchase_quantity * unitRow.factor)
    }
  }

  const { data, error } = await admin
    .from('ingredient')
    .insert({
      client_id: clientId,
      name,
      article_id,
      default_unit_id,
      kind: 'purchased',
      standard_unit_cost,
      standard_cost_currency: 'EUR',
      comment,
      yield_pct,
      purchase_quantity,
      purchase_unit_id,
      purchase_price,
      purchase_price_currency: 'EUR',
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
