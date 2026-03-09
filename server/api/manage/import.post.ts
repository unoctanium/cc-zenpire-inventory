import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'
import { resolveAppUser }     from '~/server/utils/resolve-app-user'

const EXPECTED_TABLES = [
  'unit', 'allergen', 'ingredient', 'recipe',
  'recipe_component',
] as const

type TableName = typeof EXPECTED_TABLES[number]

/**
 * POST /api/manage/import
 *
 * Replaces all business data for the current client with the contents of a
 * previously exported JSON file.
 * Requires the `admin.export` permission.
 *
 * Import order handles the circular FK between ingredient and recipe:
 *   Pass 1: unit, allergen
 *   Pass 2: ingredient (produced_by_recipe_id forced to null)
 *   Pass 3: recipe
 *   Pass 4: join/child tables (recipe_component)
 *   Pass 5: patch ingredient.produced_by_recipe_id for rows that had a non-null value
 *
 * NOTE: Keep this file in sync with export.get.ts and export-plain.get.ts whenever
 * the data model changes (columns added/removed, new tables).
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.export')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)

  // --- Validate body ---
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid body: expected JSON object' })
  }
  if (body.version !== 1) {
    throw createError({ statusCode: 400, statusMessage: `Invalid version: expected 1, got ${body.version}` })
  }
  if (body.app !== 'zenpire-inventory') {
    throw createError({ statusCode: 400, statusMessage: `Invalid app: expected zenpire-inventory, got ${body.app}` })
  }
  if (!body.tables || typeof body.tables !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Missing tables object in body' })
  }
  for (const t of EXPECTED_TABLES) {
    if (!Array.isArray(body.tables[t])) {
      throw createError({ statusCode: 400, statusMessage: `Missing or invalid table: ${t}` })
    }
  }

  const tables = body.tables as Record<TableName, any[]>
  const admin  = supabaseAdmin()

  // Override client_id on all rows to ensure they belong to this client
  function withClient(rows: any[]) {
    return rows.map(r => ({ ...r, client_id: clientId }))
  }

  async function insert(table: TableName, rows: any[]) {
    if (rows.length === 0) return
    const { error } = await admin.from(table).insert(rows)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Import failed on table ${table}: ${error.message}` })
    }
  }

  // --- Step 1: Purge current client's data in reverse dependency order ---
  const recipeIds = await admin
    .from('recipe').select('id').eq('client_id', clientId)
    .then(r => (r.data ?? []).map((x: any) => x.id))
  const ingredientIds = await admin
    .from('ingredient').select('id').eq('client_id', clientId)
    .then(r => (r.data ?? []).map((x: any) => x.id))

  if (recipeIds.length > 0) {
    await admin.from('recipe_component').delete().in('recipe_id', recipeIds)
  }
  if (ingredientIds.length > 0) {
    await admin.from('ingredient_allergen').delete().in('ingredient_id', ingredientIds)
  }
  await admin.from('recipe').delete().eq('client_id', clientId)
  await admin.from('ingredient').delete().eq('client_id', clientId)
  await admin.from('allergen').delete().eq('client_id', clientId)
  await admin.from('unit').delete().eq('client_id', clientId)

  // --- Step 2: Pass 1 — no-dep tables ---
  await insert('unit',     withClient(tables.unit))
  await insert('allergen', withClient(tables.allergen))

  // --- Step 3: Pass 2 — ingredient with produced_by_recipe_id nulled out ---
  const ingredientsWithRecipeLink = tables.ingredient.filter(r => r.produced_by_recipe_id != null)
  const ingredientsNulled = withClient(tables.ingredient.map(r => ({ ...r, produced_by_recipe_id: null })))
  await insert('ingredient', ingredientsNulled)

  // --- Step 4: Pass 3 — recipe ---
  await insert('recipe', withClient(tables.recipe))

  // --- Step 5: Pass 4 — join/child tables (no client_id column) ---
  await insert('recipe_component', tables.recipe_component)

  // --- Step 6: Pass 5 — patch produced_by_recipe_id ---
  for (const row of ingredientsWithRecipeLink) {
    const { error } = await admin
      .from('ingredient')
      .update({ produced_by_recipe_id: row.produced_by_recipe_id })
      .eq('id', row.id)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Import failed patching ingredient ${row.id}: ${error.message}` })
    }
  }

  return {
    imported: Object.fromEntries(EXPECTED_TABLES.map(t => [t, tables[t].length])),
  }
})
