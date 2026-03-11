import { createError, getQuery } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const locale = (getQuery(event).locale as string | undefined)?.toLowerCase()

  const admin = supabaseAdmin()

  // Fetch all allergens for this client
  const { data: allergenData, error: allergenErr } = await admin
    .from('allergen')
    .select('id, name, code')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (allergenErr) throw createError({ statusCode: 500, statusMessage: allergenErr.message })

  // Fetch all recipes (for names)
  const { data: recipeData, error: recipeErr } = await admin
    .from('recipe')
    .select('id, name')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (recipeErr) throw createError({ statusCode: 500, statusMessage: recipeErr.message })

  // Fetch effective allergens per recipe from the recursive view
  const recipeIds = (recipeData ?? []).map((r: any) => r.id)
  let effectiveMap = new Map<string, Set<string>>()

  if (recipeIds.length > 0) {
    const { data: effData, error: effErr } = await admin
      .from('v_recipe_effective_allergens')
      .select('recipe_id, allergen_id')
      .in('recipe_id', recipeIds)

    if (effErr) throw createError({ statusCode: 500, statusMessage: effErr.message })

    for (const row of effData ?? []) {
      const s = effectiveMap.get((row as any).recipe_id) ?? new Set<string>()
      s.add((row as any).allergen_id)
      effectiveMap.set((row as any).recipe_id, s)
    }
  }

  // Build i18n name maps when locale differs from source
  const recipeNameMap  = new Map<string, string>()
  const allergenNameMap = new Map<string, string>()
  if (locale) {
    const { data: clientRow } = await admin
      .from('client').select('content_locale').eq('id', clientId).single()
    const sourceLang = (clientRow as any)?.content_locale ?? 'de'
    if (locale !== sourceLang) {
      const allergenIds = (allergenData ?? []).map((a: any) => a.id)
      const [recipeI18n, allergenI18n] = await Promise.all([
        recipeIds.length > 0
          ? admin.from('recipe_i18n').select('recipe_id, name').in('recipe_id', recipeIds).eq('locale', locale).not('name', 'is', null)
          : { data: [] },
        allergenIds.length > 0
          ? admin.from('allergen_i18n').select('allergen_id, name').in('allergen_id', allergenIds).eq('locale', locale).not('name', 'is', null)
          : { data: [] },
      ])
      for (const row of recipeI18n.data ?? [])  recipeNameMap.set((row as any).recipe_id,  (row as any).name)
      for (const row of allergenI18n.data ?? []) allergenNameMap.set((row as any).allergen_id, (row as any).name)
    }
  }

  const recipes = (recipeData ?? []).map((r: any) => ({
    id:           r.id,
    name:         recipeNameMap.get(r.id) ?? r.name,
    allergen_ids: Array.from(effectiveMap.get(r.id) ?? []),
  }))

  const allergens = (allergenData ?? []).map((a: any) => ({
    id:      a.id,
    name:    allergenNameMap.get(a.id) ?? a.name,
    code:    a.code ?? null,
  }))

  return {
    ok: true,
    allergens,
    recipes,
  }
})
