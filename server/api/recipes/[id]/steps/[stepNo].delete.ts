import { createError, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ingredient.manage')

  const recipe_id = getRouterParam(event, 'id')
  const stepNoStr = getRouterParam(event, 'stepNo')
  if (!recipe_id || !stepNoStr) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe id or step number' })
  }
  const step_no = Number(stepNoStr)
  if (!Number.isInteger(step_no)) throw createError({ statusCode: 400, statusMessage: 'Invalid step number' })

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('recipe_step')
    .delete()
    .eq('recipe_id', recipe_id)
    .eq('step_no', step_no)

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true }
})
