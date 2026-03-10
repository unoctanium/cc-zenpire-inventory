import { createError, getQuery } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'
import { resolveAppUser } from '~/server/utils/resolve-app-user'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])
  const { clientId } = await resolveAppUser(event)

  const query = getQuery(event)
  const requestedLocale = query.locale ? String(query.locale).toLowerCase() : null

  const admin = supabaseAdmin()

  let sourceLang = 'de'
  if (requestedLocale) {
    const { data: clientRow } = await admin.from('client').select('content_locale').eq('id', clientId).single()
    sourceLang = clientRow?.content_locale ?? 'de'
  }

  const { data, error } = await admin
    .from('recipe')
    .select(`
      id,
      recipe_id,
      name,
      description,
      output_quantity,
      output_unit_id,
      standard_unit_cost,
      is_active,
      is_pre_product,
      created_at,
      updated_at,
      unit:output_unit_id ( code, unit_type )
    `)
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Fetch component counts separately
  const ids = (data ?? []).map((r: any) => r.id)
  const countMap = new Map<string, number>()

  const costMap = new Map<string, number | null>()

  if (ids.length > 0) {
    const { data: comps } = await admin
      .from('recipe_component')
      .select('recipe_id')
      .in('recipe_id', ids)

    for (const c of comps ?? []) {
      countMap.set(c.recipe_id, (countMap.get(c.recipe_id) ?? 0) + 1)
    }

    const { data: costs } = await admin
      .from('v_recipe_comp_cost')
      .select('recipe_id, comp_cost')
      .in('recipe_id', ids)

    for (const c of costs ?? []) {
      costMap.set((c as any).recipe_id, (c as any).comp_cost ?? null)
    }
  }

  // Fetch translations when locale differs from source
  const i18nMap = new Map<string, { name: string | null; description: string | null; is_machine: boolean }>()
  if (requestedLocale && requestedLocale !== sourceLang && (data ?? []).length > 0) {
    const ids = (data ?? []).map((r: any) => r.id)
    const { data: i18nRows } = await admin
      .from('recipe_i18n')
      .select('recipe_id, name, description, is_machine')
      .eq('locale', requestedLocale)
      .in('recipe_id', ids)
    for (const row of i18nRows ?? []) {
      i18nMap.set(row.recipe_id, { name: row.name, description: row.description, is_machine: row.is_machine })
    }
  }

  return {
    ok: true,
    recipes: (data ?? []).map((r: any) => {
      const t = i18nMap.get(r.id)
      return {
        id:                       r.id,
        recipe_id:                r.recipe_id ?? null,
        name:                     t?.name || r.name,
        description:              t?.description ?? r.description ?? '',
        output_quantity:          r.output_quantity,
        output_unit_id:           r.output_unit_id,
        output_unit_code:         r.unit?.code ?? '',
        output_unit_type:         r.unit?.unit_type ?? 'count',
        standard_unit_cost:       r.standard_unit_cost ?? null,
        is_active:                r.is_active,
        is_pre_product:           r.is_pre_product,
        component_count:          countMap.get(r.id) ?? 0,
        comp_cost:                costMap.get(r.id) ?? null,
        created_at:               r.created_at,
        updated_at:               r.updated_at,
        is_machine_translation:   t ? t.is_machine : false,
      }
    }),
  }
})
