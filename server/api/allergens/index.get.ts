import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('allergen')
    .select('id, name, comment, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, allergens: data ?? [] }
})
