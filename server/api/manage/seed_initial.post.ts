import { requireAdminDev } from '~/server/utils/require-admin-dev'

export default defineEventHandler(async (event) => {
  const { admin, clientId } = await requireAdminDev(event)

  // ── Units ────────────────────────────────────────────────────────────────────

  const baseUnits = [
    // Mass
    { client_id: clientId, code: 'mg',      name: 'Milligram',  unit_type: 'mass',   factor: 0.001 },
    { client_id: clientId, code: 'g',        name: 'Gram',       unit_type: 'mass',   factor: 1     },
    { client_id: clientId, code: 'kg',       name: 'Kilogram',   unit_type: 'mass',   factor: 1000  },
    // Volume
    { client_id: clientId, code: 'ml',       name: 'Milliliter', unit_type: 'volume', factor: 1     },
    { client_id: clientId, code: 'cl',       name: 'Centiliter', unit_type: 'volume', factor: 10    },
    { client_id: clientId, code: 'l',        name: 'Liter',      unit_type: 'volume', factor: 1000  },
    { client_id: clientId, code: 'tsp',      name: 'Teaspoon',   unit_type: 'volume', factor: 5     },
    { client_id: clientId, code: 'tbsp',     name: 'Tablespoon', unit_type: 'volume', factor: 15    },
    { client_id: clientId, code: 'cup',      name: 'Cup',        unit_type: 'volume', factor: 240   },
    // Count
    { client_id: clientId, code: 'pcs',      name: 'Piece',      unit_type: 'count',  factor: 1     },
    { client_id: clientId, code: 'portion',  name: 'Portion',    unit_type: 'count',  factor: 1     },
    { client_id: clientId, code: 'dozen',    name: 'Dozen',      unit_type: 'count',  factor: 12    },
  ]

  const { error: uErr } = await admin.from('unit').upsert(baseUnits, { onConflict: 'client_id,code' })
  if (uErr) throw createError({ statusCode: 500, statusMessage: uErr.message })

  // ── EU Allergens (14 mandatory) ───────────────────────────────────────────────

  // EU Regulation 1169/2011 Annex II — 14 mandatory allergens
  // GS1 AllergenTypeCode (T4078) two-letter codes for interoperability
  const allergenDefs = [
    { name: 'Gluten',          code: 'AW', comment: 'Wheat, rye, barley, oats and their hybridised strains' },
    { name: 'Crustaceans',     code: 'AC', comment: 'Shrimp, crab, lobster, crayfish' },
    { name: 'Eggs',            code: 'AE', comment: null },
    { name: 'Fish',            code: 'AF', comment: null },
    { name: 'Peanuts',         code: 'AP', comment: null },
    { name: 'Soybeans',        code: 'AY', comment: null },
    { name: 'Milk',            code: 'AM', comment: 'Including lactose' },
    { name: 'Tree Nuts',       code: 'AN', comment: 'Almonds, hazelnuts, walnuts, cashews, pecans, pistachios, macadamia nuts' },
    { name: 'Celery',          code: 'BC', comment: 'Including celeriac' },
    { name: 'Mustard',         code: 'BM', comment: null },
    { name: 'Sesame Seeds',    code: 'AS', comment: null },
    { name: 'Sulphur Dioxide', code: 'AU', comment: 'Sulphites at concentrations > 10mg/kg or 10mg/L' },
    { name: 'Lupin',           code: 'NL', comment: 'Lupin flour and seeds' },
    { name: 'Molluscs',        code: 'UM', comment: 'Clams, mussels, oysters, squid, scallops' },
  ]

  const seededAllergens: string[] = []

  for (const a of allergenDefs) {
    const { data: ex } = await admin
      .from('allergen')
      .select('id')
      .ilike('name', a.name)
      .eq('client_id', clientId)
      .maybeSingle()
    if (ex?.id) {
      await admin.from('allergen').update({ code: a.code, comment: a.comment }).eq('id', ex.id)
      seededAllergens.push(a.name)
      continue
    }
    const { error: aErr } = await admin.from('allergen').insert({ client_id: clientId, ...a })
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
