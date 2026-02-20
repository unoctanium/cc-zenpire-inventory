import { getCookie } from 'h3'
import { supabaseAdmin, supabasePublishable } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const access = getCookie(event, 'sb-access-token')
  if (!access) throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })

  const sb = supabasePublishable()
  const { data: userData } = await sb.auth.getUser(access)
  if (!userData.user) throw createError({ statusCode: 401, statusMessage: 'UNAUTHENTICATED' })

  const authUserId = userData.user.id
  const admin = supabaseAdmin()

  // RBAC check
  const { data: perms } = await admin
    .from('v_user_permissions')
    .select('permission_code')
    .eq('auth_user_id', authUserId)

  const has = new Set((perms ?? []).map((p) => p.permission_code))
  if (!has.has('stock.adjust.post')) throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })

  // Resolve app_user_id (same as /me, simplified)
  const { data: au } = await admin.from('app_user').select('id').eq('auth_user_id', authUserId).single()

  const body = await readBody<any>(event)
  const payload = {
    ingredient_id: body.ingredient_id,
    quantity: body.quantity,
    unit_id: body.unit_id ?? null,
    occurred_at: body.occurred_at ?? null,
    unit_cost_snapshot: body.unit_cost_snapshot ?? null,
    currency: body.currency ?? 'EUR',
    note: body.note ?? 'adjustment',
    created_by_user_id: au.id,
  }

  const { data, error } = await admin.rpc('fn_post_adjustment', { p_payload: payload })
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { ok: true, movement_id: data }
})
