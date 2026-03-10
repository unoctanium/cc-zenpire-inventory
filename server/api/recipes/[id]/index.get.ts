import { createError, getRouterParam, getQuery } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const query = getQuery(event)
  const requestedLocale = query.locale ? String(query.locale).toLowerCase() : null

  const admin = supabaseAdmin()

  let sourceLang = 'de'
  if (requestedLocale) {
    const { data: clientRow } = await admin.from('client').select('content_locale').eq('id', clientId).single()
    sourceLang = clientRow?.content_locale ?? 'de'
  }

  const { data: recipe, error: rErr } = await admin
    .from('recipe')
    .select(`
      id, recipe_id, name, description, production_notes, output_quantity, output_unit_id,
      standard_unit_cost, is_active, is_pre_product, name_translation_locked, created_at, updated_at,
      image_data,
      unit:output_unit_id ( code )
    `)
    .eq('id', id)
    .eq('client_id', clientId)
    .single()

  if (rErr) throw createError({ statusCode: 404, statusMessage: rErr.message })

  const { data: components, error: cErr } = await admin
    .from('recipe_component')
    .select(`
      id, recipe_id, ingredient_id, sub_recipe_id,
      quantity, unit_id, sort_order,
      ingredient:ingredient_id (
        name, standard_unit_cost, yield_pct,
        default_unit:default_unit_id ( factor )
      ),
      sub_recipe:sub_recipe_id (
        name, standard_unit_cost,
        output_unit:output_unit_id ( factor )
      ),
      unit:unit_id ( code, factor )
    `)
    .eq('recipe_id', id)
    .order('sort_order', { ascending: true })

  if (cErr) throw createError({ statusCode: 500, statusMessage: cErr.message })

  const { data: allergenData } = await admin
    .from('v_recipe_effective_allergens')
    .select('allergen_id')
    .eq('recipe_id', id)

  // Fetch translation if requested locale differs from source
  let i18nRow: { name: string | null; description: string | null; production_notes: string | null; is_machine: boolean } | null = null
  if (requestedLocale && requestedLocale !== sourceLang) {
    const { data: i18n } = await admin
      .from('recipe_i18n')
      .select('name, description, production_notes, is_machine')
      .eq('recipe_id', id)
      .eq('locale', requestedLocale)
      .single()
    if (i18n) i18nRow = i18n
  }

  const r = recipe as any
  return {
    ok: true,
    recipe: {
      ...r,
      name:                   i18nRow?.name              || r.name,
      description:            i18nRow?.description       ?? r.description,
      production_notes:       i18nRow?.production_notes  ?? r.production_notes,
      output_unit_code:       r.unit?.code ?? '',
      has_image:              !!r.image_data,
      image_data:             undefined,
      allergen_ids:           (allergenData ?? []).map((a: any) => a.allergen_id),
      is_machine_translation: i18nRow ? i18nRow.is_machine : false,
    },
    components: (components ?? []).map((c: any) => ({
      id:                   c.id,
      recipe_id:            c.recipe_id,
      ingredient_id:        c.ingredient_id,
      sub_recipe_id:        c.sub_recipe_id,
      quantity:             c.quantity,
      unit_id:              c.unit_id,
      unit_code:            c.unit?.code ?? '',
      sort_order:           c.sort_order,
      type:                 c.ingredient_id ? 'ingredient' : 'sub_recipe',
      name:                 c.ingredient_id ? (c.ingredient?.name ?? '') : (c.sub_recipe?.name ?? ''),
      std_cost:             c.ingredient_id
                              ? (c.ingredient?.standard_unit_cost ?? null)
                              : (c.sub_recipe?.standard_unit_cost ?? null),
      yield_pct:            c.ingredient_id
                              ? (c.ingredient?.yield_pct ?? 100)
                              : 100,
      base_unit_factor:     c.ingredient_id
                              ? (c.ingredient?.default_unit?.factor ?? null)
                              : (c.sub_recipe?.output_unit?.factor ?? null),
      component_unit_factor: c.unit?.factor ?? null,
    })),
  }
})
