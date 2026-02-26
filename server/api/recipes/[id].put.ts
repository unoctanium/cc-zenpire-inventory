import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ingredient.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body = await readBody(event)
  const name            = String(body?.name            ?? '').trim()
  const description     = String(body?.description     ?? '').trim() || null
  const output_quantity = Number(body?.output_quantity)
  const output_unit_id  = String(body?.output_unit_id  ?? '').trim()
  const is_active       = body?.is_active       !== false
  const is_pre_product  = body?.is_pre_product  === true

  if (!name || !output_unit_id || !(output_quantity > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Missing name, output_quantity or output_unit_id' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .update({ name, description, output_quantity, output_unit_id, is_active, is_pre_product })
    .eq('id', id)
    .select('id, name, description, output_quantity, output_unit_id, is_active, is_pre_product, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, recipe: data }
})
