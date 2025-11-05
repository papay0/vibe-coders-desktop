import { createClient } from '@supabase/supabase-js'
import { config } from './config'

export type UserSettings = {
  id: string
  clerk_user_id: string
  api_mode: 'premium' | 'byok'
  created_at: string
  updated_at: string
}

export type Project = {
  id: string
  clerk_user_id: string
  project_name: string
  project_path: string
  project_type: 'import' | 'web' | 'mobile'
  created_at: string
  updated_at: string
}

export function createClerkSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(
    config.supabase.url,
    config.supabase.anonKey,
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
