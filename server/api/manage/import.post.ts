import { requirePermission } from '~/server/utils/require-permission'
import { supabaseAdmin }      from '~/server/utils/supabase'

const EXPECTED_TABLES = [
  'unit', 'allergen', 'ingredient', 'recipe',
  'recipe_component', 'recipe_step',
  'supplier', 'supplier_offer', 'supplier_offer_price',
  'ingredient_supplier_offer', 'ingredient_stock',
] as const

type TableName = typeof EXPECTED_TABLES[number]

/**
 * POST /api/manage/import
 *
 * Replaces all business data with the contents of a previously exported JSON file.
 * Requires the `admin.export` permission.
 *
 * Import order handles the circular FK between ingredient and recipe:
 *   Pass 1: unit, allergen
 *   Pass 2: ingredient (produced_by_recipe_id forced to null)
 *   Pass 3: recipe
 *   Pass 4: join/child tables
 *   Pass 5: patch ingredient.produced_by_recipe_id for rows that had a non-null value
 *
 * NOTE: Keep this file in sync with export.get.ts and export-plain.get.ts whenever
 * the data model changes (columns added/removed, new tables).
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin.export')

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

  async function insert(table: TableName, rows: any[]) {
    if (rows.length === 0) return
    const { error } = await admin.from(table).insert(rows)
    if (error) {
      throw createError({ statusCode: 500, statusMessage: `Import failed on table ${table}: ${error.message}` })
    }
  }

  // --- Step 1: Purge ---
  const { error: purgeError } = await admin.rpc('fn_dev_purge_all')
  if (purgeError) {
    throw createError({ statusCode: 500, statusMessage: `Purge failed: ${purgeError.message}` })
  }

  // --- Step 2: Pass 1 — no-dep tables ---
  await insert('unit',     tables.unit)
  await insert('allergen', tables.allergen)

  // --- Step 3: Pass 2 — ingredient with produced_by_recipe_id nulled out ---
  const ingredientsWithRecipeLink = tables.ingredient.filter(r => r.produced_by_recipe_id != null)
  const ingredientsNulled = tables.ingredient.map(r => ({ ...r, produced_by_recipe_id: null }))
  await insert('ingredient', ingredientsNulled)

  // --- Step 4: Pass 3 — recipe ---
  await insert('recipe', tables.recipe)

  // --- Step 5: Pass 4 — join/child tables ---
  await insert('recipe_component',         tables.recipe_component)
  await insert('recipe_step',              tables.recipe_step)
  await insert('supplier',                 tables.supplier)
  await insert('supplier_offer',           tables.supplier_offer)
  await insert('supplier_offer_price',     tables.supplier_offer_price)
  await insert('ingredient_supplier_offer', tables.ingredient_supplier_offer)
  await insert('ingredient_stock',         tables.ingredient_stock)

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
