import { createClient } from '@supabase/supabase-js'

export type UserSettings = {
  id: string
  clerk_user_id: string
  api_mode: 'premium' | 'byok'
  created_at: string
  updated_at: string
}

export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          const clerkToken = await getToken()

          const headers = new Headers(options?.headers)
          headers.set('Authorization', `Bearer ${clerkToken}`)

          return fetch(url, {
            ...options,
            headers,
          })
        },
      },
    }
  )
}
