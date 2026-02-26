import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const recipe_id = getRouterParam(event, 'id')
  const stepNoStr = getRouterParam(event, 'stepNo')
  if (!recipe_id || !stepNoStr) {
    throw createError({ statusCode: 400, statusMessage: 'Missing recipe id or step number' })
  }
  const step_no = Number(stepNoStr)
  if (!Number.isInteger(step_no)) throw createError({ statusCode: 400, statusMessage: 'Invalid step number' })

  const body             = await readBody(event)
  const instruction_text = String(body?.instruction_text ?? '').trim()
  if (!instruction_text) throw createError({ statusCode: 400, statusMessage: 'instruction_text is required' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe_step')
    .update({ instruction_text })
    .eq('recipe_id', recipe_id)
    .eq('step_no', step_no)
    .select('recipe_id, step_no, instruction_text')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, step: data }
})
