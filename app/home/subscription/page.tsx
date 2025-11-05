'use client';

import { useEffect, useState } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, UserSettings } from '@/lib/supabase';
import { SubscriptionSettings } from '@/components/subscription-settings';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';

const API_KEY_STORAGE_KEY = 'vibe_coders_anthropic_api_key';

export default function SubscriptionPage() {
  const { user } = useUser();
  const { session } = useSession();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!user || !session) return;

    async function loadSettings() {
      setLoadingSettings(true);
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('clerk_user_id', user.id)
        .single();

      if (data) {
        setSettings(data);
      } else if (error && error.code === 'PGRST116') {
        // Create default settings
        const { data: newData } = await supabase
          .from('user_settings')
          .insert({
            clerk_user_id: user.id,
            api_mode: 'premium',
          })
          .select()
          .single();

        if (newData) {
          setSettings(newData);
        }
      }

      setLoadingSettings(false);
    }

    loadSettings();
  }, [user, session]);

  const handleSave = async (apiMode: 'premium' | 'byok', apiKey: string) => {
    if (!user || !session) return;

    // Save API mode to database
    const supabase = createClerkSupabaseClient(() => session.getToken());
    const { error: dbError } = await supabase
      .from('user_settings')
      .update({ api_mode: apiMode })
      .eq('clerk_user_id', user.id);

    // Save API key to localStorage (only if BYOK mode)
    if (apiMode === 'byok' && apiKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
    } else if (apiMode === 'premium') {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }

    if (!dbError) {
      setSettings((prev) => prev ? { ...prev, api_mode: apiMode } : null);
      alert('Settings saved successfully!');
    } else {
      alert('Failed to save settings: ' + dbError.message);
    }
  };

  return (
    <>
      <SetBreadcrumbName name="Subscription" />

      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Manage your plan and API configuration
          </p>
        </div>

        <SubscriptionSettings
          settings={settings}
          loading={loadingSettings}
          onSave={handleSave}
        />

        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Premium subscription</strong> includes unlimited usage with our managed API.
            With <strong className="text-foreground">BYOK (Bring Your Own Key)</strong>, you use your own Anthropic API key and only pay for what you use.
          </p>
        </div>
      </div>
    </>
  );
}
