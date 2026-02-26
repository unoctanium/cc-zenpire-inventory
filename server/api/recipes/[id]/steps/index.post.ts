import { createError, readBody, getRouterParam } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'ingredient.manage')

  const recipe_id = getRouterParam(event, 'id')
  if (!recipe_id) throw createError({ statusCode: 400, statusMessage: 'Missing recipe id' })

  const body             = await readBody(event)
  const instruction_text = String(body?.instruction_text ?? '').trim()
  if (!instruction_text) throw createError({ statusCode: 400, statusMessage: 'instruction_text is required' })

  const admin = supabaseAdmin()

  // Compute next step_no
  const { data: maxRow } = await admin
    .from('recipe_step')
    .select('step_no')
    .eq('recipe_id', recipe_id)
    .order('step_no', { ascending: false })
    .limit(1)
    .maybeSingle()

  const step_no = (maxRow?.step_no ?? 0) + 1

  const { data, error } = await admin
    .from('recipe_step')
    .insert({ recipe_id, step_no, instruction_text })
    .select('recipe_id, step_no, instruction_text')
    .single()

  if (error) throw createError({ statusCode: 400, statusMessage: error.message })
  return { ok: true, step: data }
})
