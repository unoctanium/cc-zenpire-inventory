import { createError, getRouterParam, setResponseHeader } from 'h3'
import { supabaseAdmin } from '~/server/utils/supabase'
import { requireAnyPermission } from '~/server/utils/require-any-permission'

export default defineEventHandler(async (event) => {
  await requireAnyPermission(event, ['recipe.manage', 'recipe.read'])

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' })

  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('recipe')
    .select('image_data, image_mime')
    .eq('id', id)
    .single()

  if (error) throw createError({ statusCode: 404, statusMessage: error.message })
  if (!data?.image_data) throw createError({ statusCode: 404, statusMessage: 'No image' })

  setResponseHeader(event, 'Content-Type', data.image_mime ?? 'image/jpeg')
  setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
  return Buffer.from(data.image_data, 'base64')
})
