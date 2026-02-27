import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const body    = await readBody(event)
  const name    = String(body?.name    ?? '').trim()
  const comment = body?.comment != null ? String(body.comment).trim() || null : null

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Missing name' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('allergen')
    .insert({ name, comment })
    .select('id, name, comment, created_at, updated_at')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, allergen: data }
})
