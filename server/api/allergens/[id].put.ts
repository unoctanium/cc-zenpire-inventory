import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const body    = await readBody(event)
  const name    = String(body?.name    ?? '').trim()
  const code    = body?.code    != null ? String(body.code).trim().toUpperCase().slice(0, 2) || null : null
  const comment = body?.comment != null ? String(body.comment).trim() || null : null

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('allergen')
    .update({ name, code, comment, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('client_id', clientId)
    .select('id, name, code, comment, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, allergen: data }
})
