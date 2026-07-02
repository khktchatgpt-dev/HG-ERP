import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// Server-only admin client. Uses the Supabase secret key (sb_secret_*, the
// new replacement for service_role), which bypasses RLS.
// NEVER import this from a Client Component or expose the key to the browser.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in env',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
