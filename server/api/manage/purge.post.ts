import { requireAdminDev } from '~/server/utils/require-admin-dev'

export default defineEventHandler(async (event) => {
  const { admin, clientId } = await requireAdminDev(event)

  // Delete in reverse dependency order, scoped to current client
  // ingredient_allergen and recipe_component have no client_id — go via parent
  const recipeIds = await admin
    .from('recipe')
    .select('id')
    .eq('client_id', clientId)
    .then(r => (r.data ?? []).map((x: any) => x.id))

  const ingredientIds = await admin
    .from('ingredient')
    .select('id')
    .eq('client_id', clientId)
    .then(r => (r.data ?? []).map((x: any) => x.id))

  if (recipeIds.length > 0) {
    await admin.from('recipe_i18n').delete().in('recipe_id', recipeIds)
    await admin.from('recipe_component').delete().in('recipe_id', recipeIds)
  }
  if (ingredientIds.length > 0) {
    await admin.from('ingredient_i18n').delete().in('ingredient_id', ingredientIds)
    await admin.from('ingredient_allergen').delete().in('ingredient_id', ingredientIds)
  }
  // ingredient must be deleted before recipe: ingredient.produced_by_recipe_id → recipe
  await admin.from('ingredient').delete().eq('client_id', clientId)
  await admin.from('recipe').delete().eq('client_id', clientId)
  await admin.from('allergen').delete().eq('client_id', clientId)
  await admin.from('unit').delete().eq('client_id', clientId)

  return { ok: true }
})
