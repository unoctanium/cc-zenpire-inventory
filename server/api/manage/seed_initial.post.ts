import { requireAdminDev } from '~/server/utils/require-admin-dev'

export default defineEventHandler(async (event) => {
  const { admin } = await requireAdminDev(event)

  const baseUnits = [
    { code: 'g',   name: 'Gram',       unit_type: 'mass'   },
    { code: 'kg',  name: 'Kilogram',   unit_type: 'mass'   },
    { code: 'ml',  name: 'Milliliter', unit_type: 'volume' },
    { code: 'l',   name: 'Liter',      unit_type: 'volume' },
    { code: 'pcs', name: 'Pieces',     unit_type: 'count'  },
  ]

  const { error } = await admin
    .from('unit')
    .upsert(baseUnits, { onConflict: 'code' })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true, seeded: { units: baseUnits.map((u) => u.code) } }
})