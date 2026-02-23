import { supabaseServer } from '~/server/utils/supabase'

export default defineEventHandler(async (event) => {
  const supabase = supabaseServer(event)
  await supabase.auth.signOut()
  return { ok: true }
})
