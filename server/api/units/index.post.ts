import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'unit.manage')

  const body = await readBody(event)
  const code      = String(body?.code      ?? '').trim()
  const name      = String(body?.name      ?? '').trim()
  const unit_type = String(body?.unit_type ?? '').trim()
  const factor    = body?.factor != null ? Number(body.factor) : 1

  if (!code || !name || !unit_type) {
    throw createError({ statusCode: 400, statusMessage: 'Missing code/name/unit_type' })
  }
  if (!(factor > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Factor must be a positive number' })
  }

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('unit')
    .insert({ code, name, unit_type, factor })
    .select('id, code, name, unit_type, factor')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, unit: data }
})