import { requireAdminDev } from '~/server/utils/require-admin-dev'

type U = { id: string; code: string }

export default defineEventHandler(async (event) => {
  const { admin, clientId } = await requireAdminDev(event)

  // -----------------------
  // Units — resolve IDs (seed_initial must have run first)
  // -----------------------
  const { data: units, error: uErr } = await admin
    .from('unit')
    .select('id, code')
    .eq('client_id', clientId)
  if (uErr) throw createError({ statusCode: 500, statusMessage: uErr.message })

  const unitId = new Map<string, string>((units as U[]).map((u) => [u.code, u.id]))
  const g   = unitId.get('g')
  const ml  = unitId.get('ml')
  const pcs = unitId.get('pcs')

  if (!g || !ml || !pcs) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required units g/ml/pcs not found — run Seed Initial first',
    })
  }

  // -----------------------
  // Ingredients
  // -----------------------
  const ingredientDefs = [
    { name: 'Rice',      default_unit_id: g,   kind: 'purchased', standard_unit_cost: 0.002  },
    { name: 'Vinegar',   default_unit_id: ml,  kind: 'purchased', standard_unit_cost: 0.003  },
    { name: 'Nori Leaf', default_unit_id: pcs, kind: 'purchased', standard_unit_cost: 0.08   },
    { name: 'Noodles',   default_unit_id: g,   kind: 'purchased', standard_unit_cost: 0.003  },
  ]

  const ingredientIds: Record<string, string> = {}

  for (const i of ingredientDefs) {
    const { data: ex } = await admin
      .from('ingredient')
      .select('id')
      .eq('name', i.name)
      .eq('client_id', clientId)
      .maybeSingle()
    if (ex?.id) {
      ingredientIds[i.name] = ex.id
      continue
    }
    const { data: created } = await admin
      .from('ingredient')
      .insert({ client_id: clientId, ...i })
      .select('id')
      .single()
    ingredientIds[i.name] = created!.id
  }

  // -----------------------
  // Recipes
  // -----------------------

  // Dashi — pre-product
  let dashiId: string
  const { data: exDashi } = await admin
    .from('recipe')
    .select('id')
    .eq('name', 'Dashi')
    .eq('client_id', clientId)
    .maybeSingle()
  if (exDashi?.id) {
    dashiId = exDashi.id
    await admin.from('recipe').update({
      description: 'Japanese soup stock',
      production_notes: 'Simmer nori in cold water for 30 min. Remove nori before boiling. Cool and store.',
      output_quantity: 1000,
      output_unit_id: ml,
      standard_unit_cost: 0.0004,
      is_active: true,
      is_pre_product: true,
    }).eq('id', dashiId)
  } else {
    const { data: created } = await admin.from('recipe').insert({
      client_id: clientId,
      name: 'Dashi',
      description: 'Japanese soup stock',
      production_notes: 'Simmer nori in cold water for 30 min. Remove nori before boiling. Cool and store.',
      output_quantity: 1000,
      output_unit_id: ml,
      standard_unit_cost: 0.0004,
      is_active: true,
      is_pre_product: true,
    }).select('id').single()
    dashiId = created!.id
  }

  // Dashi component: Nori Leaf × 5 pcs
  const { data: exDashiComp } = await admin.from('recipe_component')
    .select('id').eq('recipe_id', dashiId).eq('ingredient_id', ingredientIds['Nori Leaf']).maybeSingle()
  if (!exDashiComp) {
    await admin.from('recipe_component').insert({
      recipe_id: dashiId,
      ingredient_id: ingredientIds['Nori Leaf'],
      quantity: 5,
      unit_id: pcs,
      sort_order: 1,
    })
  }

  // Ramen — main recipe
  let ramenId: string
  const { data: exRamen } = await admin
    .from('recipe')
    .select('id')
    .eq('name', 'Ramen')
    .eq('client_id', clientId)
    .maybeSingle()
  if (exRamen?.id) {
    ramenId = exRamen.id
    await admin.from('recipe').update({
      description: 'Classic Japanese ramen bowl',
      production_notes: 'Cook noodles al dente. Heat dashi to 80°C. Assemble: noodles in bowl, ladle 200 ml dashi, garnish.',
      output_quantity: 1,
      output_unit_id: pcs,
      is_active: true,
      is_pre_product: false,
    }).eq('id', ramenId)
  } else {
    const { data: created } = await admin.from('recipe').insert({
      client_id: clientId,
      name: 'Ramen',
      description: 'Classic Japanese ramen bowl',
      production_notes: 'Cook noodles al dente. Heat dashi to 80°C. Assemble: noodles in bowl, ladle 200 ml dashi, garnish.',
      output_quantity: 1,
      output_unit_id: pcs,
      is_active: true,
      is_pre_product: false,
    }).select('id').single()
    ramenId = created!.id
  }

  // Ramen component: Dashi sub-recipe × 200 ml
  const { data: exRamenDashi } = await admin.from('recipe_component')
    .select('id').eq('recipe_id', ramenId).eq('sub_recipe_id', dashiId).maybeSingle()
  if (!exRamenDashi) {
    await admin.from('recipe_component').insert({
      recipe_id: ramenId,
      sub_recipe_id: dashiId,
      quantity: 200,
      unit_id: ml,
      sort_order: 1,
    })
  }

  // Ramen component: Noodles × 120 g
  const { data: exRamenNoodles } = await admin.from('recipe_component')
    .select('id').eq('recipe_id', ramenId).eq('ingredient_id', ingredientIds['Noodles']).maybeSingle()
  if (!exRamenNoodles) {
    await admin.from('recipe_component').insert({
      recipe_id: ramenId,
      ingredient_id: ingredientIds['Noodles'],
      quantity: 120,
      unit_id: g,
      sort_order: 2,
    })
  }

  return { ok: true }
})
