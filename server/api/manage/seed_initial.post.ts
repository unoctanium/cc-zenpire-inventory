import { requireAdminDev } from '~/server/utils/require-admin-dev'

export default defineEventHandler(async (event) => {
  const { admin } = await requireAdminDev(event)

  const baseUnits = [
    { code: 'g',   name: 'Gram',       unit_type: 'mass',   factor: 1    },
    { code: 'kg',  name: 'Kilogram',   unit_type: 'mass',   factor: 1000 },
    { code: 'ml',  name: 'Milliliter', unit_type: 'volume', factor: 1    },
    { code: 'l',   name: 'Liter',      unit_type: 'volume', factor: 1000 },
    { code: 'pcs', name: 'Pieces',     unit_type: 'count',  factor: 1    },
  ]

  const { error } = await admin
    .from('unit')
    .upsert(baseUnits, { onConflict: 'code' })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true, seeded: { units: baseUnits.map((u) => u.code) } }
})