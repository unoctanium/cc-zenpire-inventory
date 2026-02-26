import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['unit.manage', 'unit.read'])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('unit')
    .select('id, code, name, unit_type, factor')
    .order('unit_type', { ascending: true })
    .order('code', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, units: data ?? [] }
})