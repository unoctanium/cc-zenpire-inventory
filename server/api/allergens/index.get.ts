import { createError, getQuery } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const query = getQuery(event)
  const requestedLocale = query.locale ? String(query.locale).toLowerCase() : null

  const admin = supabaseAdmin()

  let sourceLang = 'de'
  if (requestedLocale) {
    const { data: clientRow } = await admin.from('client').select('content_locale').eq('id', clientId).single()
    sourceLang = (clientRow as any)?.content_locale ?? 'de'
  }

  const { data, error } = await admin
    .from('allergen')
    .select('id, name, code, comment, created_at, updated_at')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Fetch translations when locale differs from source
  const i18nMap = new Map<string, { name: string | null; comment: string | null; is_machine: boolean }>()
  if (requestedLocale && requestedLocale !== sourceLang && (data ?? []).length > 0) {
    const ids = (data ?? []).map((r: any) => r.id)
    const { data: i18nRows } = await admin
      .from('allergen_i18n')
      .select('allergen_id, name, comment, is_machine')
      .eq('locale', requestedLocale)
      .in('allergen_id', ids)
    for (const row of i18nRows ?? []) {
      i18nMap.set((row as any).allergen_id, { name: (row as any).name, comment: (row as any).comment, is_machine: (row as any).is_machine })
    }
  }

  return {
    ok: true,
    allergens: (data ?? []).map((r: any) => {
      const t = i18nMap.get(r.id)
      return {
        id:         r.id,
        name:       (t?.name) || r.name,
        code:       r.code ?? null,
        comment:    (t !== undefined ? t.comment : r.comment) ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
        is_machine_translation: t ? t.is_machine : false,
      }
    }),
  }
})
