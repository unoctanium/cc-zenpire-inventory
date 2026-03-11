/**
 * POST /api/admin/translations/item
 * Translate a single ingredient or recipe into one or all non-source locales.
 *
 * Body: { kind: 'ingredient' | 'recipe', id: string, locale?: string }
 * If locale is omitted, translates into all non-source locales.
 * Response: { ok, translated, skipped, errors }
 */
import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { translateTexts } from '~/server/utils/deepl'

// Locales supported by the app
const APP_LOCALES = ['de', 'en', 'ja']

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const kind: string = String(body?.kind ?? '').trim()
  const id: string   = String(body?.id   ?? '').trim()
  const localeParam  = body?.locale ? String(body.locale).trim().toLowerCase() : null

  if (!kind || !id) throw createError({ statusCode: 400, statusMessage: 'Missing kind or id' })
  if (kind !== 'ingredient' && kind !== 'recipe' && kind !== 'allergen') {
    throw createError({ statusCode: 400, statusMessage: 'kind must be ingredient, recipe or allergen' })
  }

  const admin = supabaseAdmin()

  // Get client source locale
  const { data: clientRow } = await admin
    .from('client')
    .select('content_locale')
    .eq('id', clientId)
    .single()
  const sourceLang = clientRow?.content_locale ?? 'de'

  const targetLocales = localeParam
    ? [localeParam]
    : APP_LOCALES.filter(l => l !== sourceLang)

  let translated = 0
  let skipped = 0
  let errors = 0

  if (kind === 'ingredient') {
    const { data: ing, error } = await admin
      .from('ingredient')
      .select('id, name, comment, name_translation_locked')
      .eq('id', id)
      .eq('client_id', clientId)
      .single()

    if (error || !ing) throw createError({ statusCode: 404, statusMessage: 'Ingredient not found' })

    for (const locale of targetLocales) {
      if (locale === sourceLang) continue
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

        if (!textsToTranslate.length) { skipped++; continue }

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
  } else {
    const { data: rec, error } = await admin
      .from('recipe')
      .select('id, name, description, production_notes, name_translation_locked')
      .eq('id', id)
      .eq('client_id', clientId)
      .single()

    if (error || !rec) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

    for (const locale of targetLocales) {
      if (locale === sourceLang) continue
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

        if (!textsToTranslate.length) { skipped++; continue }

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

  if (kind === 'allergen') {
    const { data: alg, error } = await admin
      .from('allergen')
      .select('id, name, comment')
      .eq('id', id)
      .eq('client_id', clientId)
      .single()

    if (error || !alg) throw createError({ statusCode: 404, statusMessage: 'Allergen not found' })

    for (const locale of targetLocales) {
      if (locale === sourceLang) continue
      try {
        const textsToTranslate: string[] = []
        const fields: string[] = []

        if (alg.name) {
          textsToTranslate.push(alg.name)
          fields.push('name')
        }
        if (alg.comment) {
          textsToTranslate.push(alg.comment)
          fields.push('comment')
        }

        if (!textsToTranslate.length) { skipped++; continue }

        const translated_texts = await translateTexts(textsToTranslate, locale, sourceLang)
        const row: Record<string, unknown> = {
          allergen_id: alg.id,
          locale,
          is_machine: true,
          is_stale: false,
          updated_at: new Date().toISOString(),
        }
        fields.forEach((f, i) => { row[f] = translated_texts[i] })

        await admin.from('allergen_i18n').upsert(row, { onConflict: 'allergen_id,locale' })
        translated++
      } catch {
        errors++
      }
    }
  }

  return { ok: true, translated, skipped, errors }
})
