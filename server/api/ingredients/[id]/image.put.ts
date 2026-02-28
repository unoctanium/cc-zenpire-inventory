import { createError, getRouterParam, readMultipartFormData } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requirePermission } from '~/server/utils/require-permission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'recipe.manage')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const parts = await readMultipartFormData(event)
  const file  = parts?.find(p => p.name === 'image')
  if (!file?.data?.length) throw createError({ statusCode: 400, statusMessage: 'No image provided' })

  const mime   = file.type ?? 'image/jpeg'
  const base64 = Buffer.from(file.data).toString('base64')

  const admin = supabaseAdmin()
  const { error } = await admin
    .from('ingredient')
    .update({ image_data: base64, image_mime: mime })
    .eq('id', id)

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
