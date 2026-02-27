import { requireAdminDev } from '~/server/utils/require-admin-dev'

export default defineEventHandler(async (event) => {
  const { admin } = await requireAdminDev(event)

  // ── Units ────────────────────────────────────────────────────────────────────

  const baseUnits = [
    { code: 'g',   name: 'Gram',       unit_type: 'mass',   factor: 1    },
    { code: 'kg',  name: 'Kilogram',   unit_type: 'mass',   factor: 1000 },
    { code: 'ml',  name: 'Milliliter', unit_type: 'volume', factor: 1    },
    { code: 'l',   name: 'Liter',      unit_type: 'volume', factor: 1000 },
    { code: 'pcs', name: 'Pieces',     unit_type: 'count',  factor: 1    },
  ]

  const { error: uErr } = await admin.from('unit').upsert(baseUnits, { onConflict: 'code' })
  if (uErr) throw createError({ statusCode: 500, statusMessage: uErr.message })

  // ── EU Allergens (14 mandatory) ───────────────────────────────────────────────

  const allergenDefs = [
    { name: 'Gluten',              comment: 'Wheat, rye, barley, oats and their hybridised strains' },
    { name: 'Crustaceans',         comment: 'Shrimp, crab, lobster, crayfish' },
    { name: 'Eggs',                comment: null },
    { name: 'Fish',                comment: null },
    { name: 'Peanuts',             comment: null },
    { name: 'Soybeans',            comment: null },
    { name: 'Milk',                comment: 'Including lactose' },
    { name: 'Tree Nuts',           comment: 'Almonds, hazelnuts, walnuts, cashews, pecans, pistachios, macadamia nuts' },
    { name: 'Celery',              comment: 'Including celeriac' },
    { name: 'Mustard',             comment: null },
    { name: 'Sesame Seeds',        comment: null },
    { name: 'Sulphur Dioxide',     comment: 'Sulphites at concentrations > 10mg/kg or 10mg/L' },
    { name: 'Lupin',               comment: 'Lupin flour and seeds' },
    { name: 'Molluscs',            comment: 'Clams, mussels, oysters, squid, scallops' },
  ]

  const seededAllergens: string[] = []

  for (const a of allergenDefs) {
    const { data: ex } = await admin.from('allergen').select('id').ilike('name', a.name).maybeSingle()
    if (ex?.id) {
      await admin.from('allergen').update({ comment: a.comment }).eq('id', ex.id)
      seededAllergens.push(a.name)
      continue
    }
    const { error: aErr } = await admin.from('allergen').insert(a)
    if (aErr) throw createError({ statusCode: 500, statusMessage: aErr.message })
    seededAllergens.push(a.name)
  }

  return {
    ok: true,
    seeded: {
      units:    baseUnits.map((u) => u.code),
      allergens: seededAllergens,
    },
  }
})