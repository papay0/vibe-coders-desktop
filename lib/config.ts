/**
 * Public configuration for Vibe Coders Desktop
 *
 * These are public keys that are safe to commit to the repository.
 * They are used for client-side authentication and API access.
 *
 * IMPORTANT: Never commit private keys (service role keys, secrets, etc.)
 */

export const config = {
  /**
   * Clerk Authentication Configuration
   * Clerk handles user authentication and session management
   */
  clerk: {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      'pk_test_ZXRlcm5hbC11cmNoaW4tMjQuY2xlcmsuYWNjb3VudHMuZGV2JA',
  },

  /**
   * Supabase Database Configuration
   * These are public keys safe for client-side use
   */
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ||
      'https://yhjlyfonlnfbbchvxvzy.supabase.co',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inloamx5Zm9ubG5mYmJjaHZ4dnp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDU0NzMsImV4cCI6MjA3Nzg4MTQ3M30.0YHEf7AamrbNqpBVazY66B2A_Is4Y4GH20S0f0J9qq0',
  },

  /**
   * Claude Agent SDK Configuration
   * IMPORTANT: Must be set in .env.local - this is a private key!
   */
  claude: {
    oauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  },
} as const;

/**
 * Type-safe access to configuration values
 */
export type Config = typeof config;

/**
 * Helper function to get environment-specific values
 */
export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';
