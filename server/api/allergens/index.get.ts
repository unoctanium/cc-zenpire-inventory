import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('allergen')
    .select('id, name, code, comment, created_at, updated_at')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true, allergens: data ?? [] }
})
