/**
 * POST /api/admin/translations/batch
 * Translate all missing or stale ingredient, recipe, and allergen translations
 * for a given target locale.
 *
 * Body: { locale: string, stale_only?: boolean }
 * Response: { ok, translated, skipped, errors }
 *
 * Uses a single batched DeepL call per entity type to minimise latency.
 */
import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { translateTexts } from '~/server/utils/deepl'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const locale: string = String(body?.locale ?? '').trim().toLowerCase()

  if (!locale) throw createError({ statusCode: 400, statusMessage: 'Missing locale' })

  const admin = supabaseAdmin()

  // Get client source locale
  const { data: clientRow } = await admin
    .from('client')
    .select('content_locale')
    .eq('id', clientId)
    .single()
  const sourceLang = clientRow?.content_locale ?? 'de'

  if (locale === sourceLang) {
    throw createError({ statusCode: 400, statusMessage: 'Target locale equals source locale' })
  }

  let translated = 0
  let skipped = 0
  let errors = 0

  const now = new Date().toISOString()

  // ── Ingredients ──────────────────────────────────────────────────────────
  const { data: ingredients } = await admin
    .from('ingredient')
    .select('id, name, comment, name_translation_locked')
    .eq('client_id', clientId)

  if (ingredients?.length) {
    const ingredientIds = ingredients.map(i => i.id)
    const { data: existingRows } = await admin
      .from('ingredient_i18n')
      .select('ingredient_id, is_stale')
      .eq('locale', locale)
      .in('ingredient_id', ingredientIds)

    const existingMap = new Map((existingRows ?? []).map(r => [r.ingredient_id, r]))

    // Build work list: items that need translation
    type WorkItem = { id: string; fields: string[]; offset: number; count: number }
    const workList: WorkItem[] = []
    const allTexts: string[] = []

    for (const ing of ingredients) {
      const existing = existingMap.get(ing.id)
      if (existing && !existing.is_stale) { skipped++; continue }

      const texts: string[] = []
      const fields: string[] = []
      if (!ing.name_translation_locked && ing.name) { texts.push(ing.name); fields.push('name') }
      if (ing.comment) { texts.push(ing.comment); fields.push('comment') }

      if (!texts.length) { skipped++; continue }

      workList.push({ id: ing.id, fields, offset: allTexts.length, count: texts.length })
      allTexts.push(...texts)
    }

    if (allTexts.length) {
      try {
        const translatedTexts = await translateTexts(allTexts, locale, sourceLang)
        for (const work of workList) {
          try {
            const row: Record<string, unknown> = {
              ingredient_id: work.id,
              locale,
              is_machine: true,
              is_stale: false,
              updated_at: now,
            }
            work.fields.forEach((f, i) => { row[f] = translatedTexts[work.offset + i] })
            await admin.from('ingredient_i18n').upsert(row, { onConflict: 'ingredient_id,locale' })
            translated++
          } catch { errors++ }
        }
      } catch {
        errors += workList.length
      }
    }
  }

  // ── Recipes ───────────────────────────────────────────────────────────────
  const { data: recipes } = await admin
    .from('recipe')
    .select('id, name, description, production_notes, name_translation_locked')
    .eq('client_id', clientId)

  if (recipes?.length) {
    const recipeIds = recipes.map(r => r.id)
    const { data: existingRows } = await admin
      .from('recipe_i18n')
      .select('recipe_id, is_stale')
      .eq('locale', locale)
      .in('recipe_id', recipeIds)

    const existingMap = new Map((existingRows ?? []).map(r => [r.recipe_id, r]))

    type WorkItem = { id: string; fields: string[]; offset: number; count: number }
    const workList: WorkItem[] = []
    const allTexts: string[] = []

    for (const rec of recipes) {
      const existing = existingMap.get(rec.id)
      if (existing && !existing.is_stale) { skipped++; continue }

      const texts: string[] = []
      const fields: string[] = []
      if (!rec.name_translation_locked && rec.name) { texts.push(rec.name); fields.push('name') }
      if (rec.description) { texts.push(rec.description); fields.push('description') }
      if (rec.production_notes) { texts.push(rec.production_notes); fields.push('production_notes') }

      if (!texts.length) { skipped++; continue }

      workList.push({ id: rec.id, fields, offset: allTexts.length, count: texts.length })
      allTexts.push(...texts)
    }

    if (allTexts.length) {
      try {
        const translatedTexts = await translateTexts(allTexts, locale, sourceLang)
        for (const work of workList) {
          try {
            const row: Record<string, unknown> = {
              recipe_id: work.id,
              locale,
              is_machine: true,
              is_stale: false,
              updated_at: now,
            }
            work.fields.forEach((f, i) => { row[f] = translatedTexts[work.offset + i] })
            await admin.from('recipe_i18n').upsert(row, { onConflict: 'recipe_id,locale' })
            translated++
          } catch { errors++ }
        }
      } catch {
        errors += workList.length
      }
    }
  }

  // ── Allergens ─────────────────────────────────────────────────────────────
  const { data: allergens } = await admin
    .from('allergen')
    .select('id, name, comment')
    .eq('client_id', clientId)

  if (allergens?.length) {
    const allergenIds = allergens.map(a => a.id)
    const { data: existingRows } = await admin
      .from('allergen_i18n')
      .select('allergen_id, is_stale')
      .eq('locale', locale)
      .in('allergen_id', allergenIds)

    const existingMap = new Map((existingRows ?? []).map(r => [r.allergen_id, r]))

    type WorkItem = { id: string; fields: string[]; offset: number; count: number }
    const workList: WorkItem[] = []
    const allTexts: string[] = []

    for (const alg of allergens) {
      const existing = existingMap.get(alg.id)
      if (existing && !existing.is_stale) { skipped++; continue }

      const texts: string[] = []
      const fields: string[] = []
      if (alg.name) { texts.push(alg.name); fields.push('name') }
      if (alg.comment) { texts.push(alg.comment); fields.push('comment') }

      if (!texts.length) { skipped++; continue }

      workList.push({ id: alg.id, fields, offset: allTexts.length, count: texts.length })
      allTexts.push(...texts)
    }

    if (allTexts.length) {
      try {
        const translatedTexts = await translateTexts(allTexts, locale, sourceLang)
        for (const work of workList) {
          try {
            const row: Record<string, unknown> = {
              allergen_id: work.id,
              locale,
              is_machine: true,
              is_stale: false,
              updated_at: now,
            }
            work.fields.forEach((f, i) => { row[f] = translatedTexts[work.offset + i] })
            await admin.from('allergen_i18n').upsert(row, { onConflict: 'allergen_id,locale' })
            translated++
          } catch { errors++ }
        }
      } catch {
        errors += workList.length
      }
    }
  }

  return { ok: true, translated, skipped, errors }
})
