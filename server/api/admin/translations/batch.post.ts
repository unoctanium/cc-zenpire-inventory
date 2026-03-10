/**
 * POST /api/admin/translations/batch
 * Translate all missing or stale ingredient and recipe translations
 * for a given target locale.
 *
 * Body: { locale: string, stale_only?: boolean }
 * Response: { ok, translated, skipped, errors }
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
  const staleOnly: boolean = body?.stale_only === true

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

  // ── Ingredients ──────────────────────────────────────────────────────────
  const { data: ingredients } = await admin
    .from('ingredient')
    .select('id, name, comment, name_translation_locked')
    .eq('client_id', clientId)

  if (ingredients) {
    // Get existing i18n rows for this locale
    const ingredientIds = ingredients.map(i => i.id)
    const { data: existingRows } = await admin
      .from('ingredient_i18n')
      .select('ingredient_id, is_stale')
      .eq('locale', locale)
      .in('ingredient_id', ingredientIds)

    const existingMap = new Map((existingRows ?? []).map(r => [r.ingredient_id, r]))

    for (const ing of ingredients) {
      const existing = existingMap.get(ing.id)
      const needsTranslation = !existing || (staleOnly ? existing.is_stale : existing.is_stale)
      const isNew = !existing

      if (!isNew && !existing?.is_stale) {
        skipped++
        continue
      }

      try {
        const textsToTranslate: string[] = []
        const fields: string[] = []

        if (!ing.name_translation_locked && ing.name) {
          textsToTranslate.push(ing.name)
          fields.push('name')
        }
        if (ing.comment) {
          textsToTranslate.push(ing.comment)
          fields.push('comment')
        }

        if (!textsToTranslate.length) {
          skipped++
          continue
        }

        const translated_texts = await translateTexts(textsToTranslate, locale, sourceLang)
        const row: Record<string, unknown> = {
          ingredient_id: ing.id,
          locale,
          is_machine: true,
          is_stale: false,
          updated_at: new Date().toISOString(),
        }
        fields.forEach((f, i) => { row[f] = translated_texts[i] })

        await admin.from('ingredient_i18n').upsert(row, { onConflict: 'ingredient_id,locale' })
        translated++
      } catch {
        errors++
      }
    }
  }

  // ── Recipes ───────────────────────────────────────────────────────────────
  const { data: recipes } = await admin
    .from('recipe')
    .select('id, name, description, production_notes, name_translation_locked')
    .eq('client_id', clientId)

  if (recipes) {
    const recipeIds = recipes.map(r => r.id)
    const { data: existingRows } = await admin
      .from('recipe_i18n')
      .select('recipe_id, is_stale')
      .eq('locale', locale)
      .in('recipe_id', recipeIds)

    const existingMap = new Map((existingRows ?? []).map(r => [r.recipe_id, r]))

    for (const rec of recipes) {
      const existing = existingMap.get(rec.id)
      const isNew = !existing

      if (!isNew && !existing?.is_stale) {
        skipped++
        continue
      }

      try {
        const textsToTranslate: string[] = []
        const fields: string[] = []

        if (!rec.name_translation_locked && rec.name) {
          textsToTranslate.push(rec.name)
          fields.push('name')
        }
        if (rec.description) {
          textsToTranslate.push(rec.description)
          fields.push('description')
        }
        if (rec.production_notes) {
          textsToTranslate.push(rec.production_notes)
          fields.push('production_notes')
        }

        if (!textsToTranslate.length) {
          skipped++
          continue
        }

        const translated_texts = await translateTexts(textsToTranslate, locale, sourceLang)
        const row: Record<string, unknown> = {
          recipe_id: rec.id,
          locale,
          is_machine: true,
          is_stale: false,
          updated_at: new Date().toISOString(),
        }
        fields.forEach((f, i) => { row[f] = translated_texts[i] })

        await admin.from('recipe_i18n').upsert(row, { onConflict: 'recipe_id,locale' })
        translated++
      } catch {
        errors++
      }
    }
  }

  return { ok: true, translated, skipped, errors }
})
