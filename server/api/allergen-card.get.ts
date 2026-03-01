import { createError } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const admin = supabaseAdmin()

  // Fetch all allergens
  const { data: allergenData, error: allergenErr } = await admin
    .from('allergen')
    .select('id, name')
    .order('name', { ascending: true })

  if (allergenErr) throw createError({ statusCode: 500, statusMessage: allergenErr.message })

  // Fetch all recipes with their component ingredients' allergens.
  // Use FK hint to resolve ambiguity: recipe_component has both recipe_id and
  // sub_recipe_id pointing to recipe; we want the recipe_id (parent) relationship.
  const { data: recipeData, error: recipeErr } = await admin
    .from('recipe')
    .select(`
      id,
      name,
      recipe_component!recipe_component_recipe_id_fkey (
        ingredient_id,
        ingredient:ingredient_id (
          ingredient_allergen ( allergen_id )
        )
      )
    `)
    .order('name', { ascending: true })

  if (recipeErr) throw createError({ statusCode: 500, statusMessage: recipeErr.message })

  // Extract unique allergen IDs per recipe
  const recipes = (recipeData ?? []).map((r: any) => {
    const allergenIds = new Set<string>()
    // Supabase returns the FK-hinted relation under the original table name key
    const comps = r.recipe_component ?? r['recipe_component!recipe_component_recipe_id_fkey'] ?? []
    for (const comp of comps) {
      for (const ia of comp.ingredient?.ingredient_allergen ?? []) {
        allergenIds.add(ia.allergen_id)
      }
    }
    return {
      id:          r.id,
      name:        r.name,
      allergen_ids: Array.from(allergenIds),
    }
  })

  return {
    ok:       true,
    allergens: allergenData ?? [],
    recipes,
  }
})
