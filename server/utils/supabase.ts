 import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function supabasePublishable() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabasePublishableKey)
}