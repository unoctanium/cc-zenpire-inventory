import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const admin = supabaseAdmin()

  // Fetch all allergens for this client
  const { data: allergenData, error: allergenErr } = await admin
    .from('allergen')
    .select('id, name')
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

  const recipes = (recipeData ?? []).map((r: any) => ({
    id:           r.id,
    name:         r.name,
    allergen_ids: Array.from(effectiveMap.get(r.id) ?? []),
  }))

  return {
    ok:       true,
    allergens: allergenData ?? [],
    recipes,
  }
})
