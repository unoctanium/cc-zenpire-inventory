import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'unit.manage')

  const config = useRuntimeConfig()
  if (!config.devMode) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Unit deletion is disabled (DEV_MODE only)',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()
  const { error } = await admin.from('unit').delete().eq('id', id)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})