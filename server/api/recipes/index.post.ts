import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const name               = String(body?.name             ?? '').trim()
  const recipe_id          = String(body?.recipe_id        ?? '').trim() || null
  const description        = String(body?.description      ?? '').trim() || null
  const production_notes   = String(body?.production_notes ?? '').trim() || null
  const output_quantity    = Number(body?.output_quantity)
  const output_unit_id     = String(body?.output_unit_id   ?? '').trim()
  const is_active          = body?.is_active      !== false
  const is_pre_product     = body?.is_pre_product === true
  const standard_unit_cost = body?.standard_unit_cost != null ? Number(body.standard_unit_cost) : null

  if (!name || !output_unit_id || !(output_quantity > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name, output_quantity or output_unit_id' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .insert({ client_id: clientId, name, recipe_id, description, production_notes, output_quantity, output_unit_id, standard_unit_cost, is_active, is_pre_product })
    .select('id, recipe_id, name, description, production_notes, output_quantity, output_unit_id, standard_unit_cost, is_active, is_pre_product, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, recipe: data }
})
