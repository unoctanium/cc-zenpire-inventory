/**
 * POST /api/admin/translations/item
 * Translate a single ingredient, recipe, or allergen.
 *
 * Body: { kind: 'ingredient' | 'recipe' | 'allergen', id: string, locale?: string, fromLocale?: string }
 *
 * fromLocale: locale to translate FROM.
 *   - Omitted / equals sourceLang → read from the main table, translate to all non-source locales (original behaviour)
 *   - Non-source locale           → read from the i18n table for that locale, translate to all other
 *                                   non-source locales (source language main table is NOT modified)
 *
 * locale: restrict output to a single target locale (optional).
 * Response: { ok, translated, skipped, errors }
 */
import { createError, readBody } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'
import { translateTexts } from '~/server/utils/deepl'

const APP_LOCALES = ['de', 'en', 'ja']

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admin')
  const { clientId } = await resolveAppUser(event)

  const body = await readBody(event)
  const kind: string = String(body?.kind ?? '').trim()
  const id: string   = String(body?.id   ?? '').trim()
  const localeParam  = body?.locale     ? String(body.locale).trim().toLowerCase()     : null
  const fromLocale   = body?.fromLocale ? String(body.fromLocale).trim().toLowerCase() : null

  if (!kind || !id) throw createError({ statusCode: 400, statusMessage: 'Missing kind or id' })
  if (kind !== 'ingredient' && kind !== 'recipe' && kind !== 'allergen') {
    throw createError({ statusCode: 400, statusMessage: 'kind must be ingredient, recipe or allergen' })
  }

  const admin = supabaseAdmin()

  const { data: clientRow } = await admin
    .from('client').select('content_locale').eq('id', clientId).single()
  const sourceLang = clientRow?.content_locale ?? 'de'

  // When translating from a non-source locale, we read from the i18n table and skip source as target
  const isNonSourceFrom = !!fromLocale && fromLocale !== sourceLang
  const translationFrom = isNonSourceFrom ? fromLocale! : sourceLang

  const targetLocales = localeParam
    ? [localeParam]
    : APP_LOCALES.filter(l => l !== translationFrom)

  let translated = 0
  let skipped    = 0
  let errors     = 0

  // ── Ingredient ──────────────────────────────────────────────────────────────
  if (kind === 'ingredient') {
    let nameText:    string | null = null
    let commentText: string | null = null
    let nameLocked = false

    if (isNonSourceFrom) {
      const { data: i18nRow } = await admin
        .from('ingredient_i18n')
        .select('name, comment')
        .eq('ingredient_id', id).eq('locale', translationFrom).single()
      if (!i18nRow) { return { ok: true, translated: 0, skipped: 1, errors: 0 } }
      nameText    = i18nRow.name    ?? null
      commentText = i18nRow.comment ?? null
    } else {
      const { data: ing, error } = await admin
        .from('ingredient')
        .select('id, name, comment, name_translation_locked')
        .eq('id', id).eq('client_id', clientId).single()
      if (error || !ing) throw createError({ statusCode: 404, statusMessage: 'Ingredient not found' })
      nameText    = ing.name    ?? null
      commentText = ing.comment ?? null
      nameLocked  = ing.name_translation_locked ?? false
    }

    for (const locale of targetLocales) {
      try {
        const texts: string[] = []
        const fields: string[] = []

        if (!nameLocked && nameText)    { texts.push(nameText);    fields.push('name') }
        if (commentText)                { texts.push(commentText); fields.push('comment') }

        if (!texts.length) { skipped++; continue }

        const out = await translateTexts(texts, locale, translationFrom)
        const update: Record<string, unknown> = {}
        fields.forEach((f, i) => { update[f] = out[i] })

        if (locale === sourceLang) {
          // Write back to the main table so the source-language view reflects the translation
          await admin.from('ingredient').update(update).eq('id', id).eq('client_id', clientId)
        } else {
          await admin.from('ingredient_i18n').upsert(
            { ingredient_id: id, locale, is_machine: true, is_stale: false, updated_at: new Date().toISOString(), ...update },
            { onConflict: 'ingredient_id,locale' }
          )
        }
        translated++
      } catch { errors++ }
    }
  }

  // ── Recipe ───────────────────────────────────────────────────────────────────
  if (kind === 'recipe') {
    let nameText:          string | null = null
    let descriptionText:   string | null = null
    let productionNotes:   string | null = null
    let nameLocked = false

    if (isNonSourceFrom) {
      const { data: i18nRow } = await admin
        .from('recipe_i18n')
        .select('name, description, production_notes')
        .eq('recipe_id', id).eq('locale', translationFrom).single()
      if (!i18nRow) { return { ok: true, translated: 0, skipped: 1, errors: 0 } }
      nameText        = i18nRow.name            ?? null
      descriptionText = i18nRow.description     ?? null
      productionNotes = i18nRow.production_notes ?? null
    } else {
      const { data: rec, error } = await admin
        .from('recipe')
        .select('id, name, description, production_notes, name_translation_locked')
        .eq('id', id).eq('client_id', clientId).single()
      if (error || !rec) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
      nameText        = rec.name            ?? null
      descriptionText = rec.description     ?? null
      productionNotes = rec.production_notes ?? null
      nameLocked      = rec.name_translation_locked ?? false
    }

    for (const locale of targetLocales) {
      try {
        const texts: string[] = []
        const fields: string[] = []

        if (!nameLocked && nameText)  { texts.push(nameText);        fields.push('name') }
        if (descriptionText)          { texts.push(descriptionText); fields.push('description') }
        if (productionNotes)          { texts.push(productionNotes); fields.push('production_notes') }

        if (!texts.length) { skipped++; continue }

        const out = await translateTexts(texts, locale, translationFrom)
        const update: Record<string, unknown> = {}
        fields.forEach((f, i) => { update[f] = out[i] })

        if (locale === sourceLang) {
          await admin.from('recipe').update(update).eq('id', id).eq('client_id', clientId)
        } else {
          await admin.from('recipe_i18n').upsert(
            { recipe_id: id, locale, is_machine: true, is_stale: false, updated_at: new Date().toISOString(), ...update },
            { onConflict: 'recipe_id,locale' }
          )
        }
        translated++
      } catch { errors++ }
    }
  }

  // ── Allergen ─────────────────────────────────────────────────────────────────
  if (kind === 'allergen') {
    let nameText:    string | null = null
    let commentText: string | null = null

    if (isNonSourceFrom) {
      const { data: i18nRow } = await admin
        .from('allergen_i18n')
        .select('name, comment')
        .eq('allergen_id', id).eq('locale', translationFrom).single()
      if (!i18nRow) { return { ok: true, translated: 0, skipped: 1, errors: 0 } }
      nameText    = i18nRow.name    ?? null
      commentText = i18nRow.comment ?? null
    } else {
      const { data: alg, error } = await admin
        .from('allergen')
        .select('id, name, comment')
        .eq('id', id).eq('client_id', clientId).single()
      if (error || !alg) throw createError({ statusCode: 404, statusMessage: 'Allergen not found' })
      nameText    = alg.name    ?? null
      commentText = alg.comment ?? null
    }

    for (const locale of targetLocales) {
      try {
        const texts: string[] = []
        const fields: string[] = []

        if (nameText)    { texts.push(nameText);    fields.push('name') }
        if (commentText) { texts.push(commentText); fields.push('comment') }

        if (!texts.length) { skipped++; continue }

        const out = await translateTexts(texts, locale, translationFrom)
        const update: Record<string, unknown> = {}
        fields.forEach((f, i) => { update[f] = out[i] })

        if (locale === sourceLang) {
          await admin.from('allergen').update(update).eq('id', id).eq('client_id', clientId)
        } else {
          await admin.from('allergen_i18n').upsert(
            { allergen_id: id, locale, is_machine: true, is_stale: false, updated_at: new Date().toISOString(), ...update },
            { onConflict: 'allergen_id,locale' }
          )
        }
        translated++
      } catch { errors++ }
    }
  }

  return { ok: true, translated, skipped, errors }
})
