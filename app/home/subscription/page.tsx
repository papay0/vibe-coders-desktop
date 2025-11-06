'use client';

import { useEffect, useState, useCallback } from 'react';
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

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    if (!user || !session) return;

    setLoadingSettings(true);
    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('clerk_user_id', user.id)
        .single();

      // Check if request was aborted
      if (signal?.aborted) return;

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

        if (!signal?.aborted && newData) {
          setSettings(newData);
        }
      }
    } catch (error) {
      if (signal?.aborted) return; // Ignore errors from aborted requests
      console.error('Error loading settings:', error);
    } finally {
      if (!signal?.aborted) {
        setLoadingSettings(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const abortController = new AbortController();
    loadSettings(abortController.signal);

    // Cleanup: abort the request if component unmounts or effect re-runs
    return () => {
      abortController.abort();
    };
  }, [loadSettings]);

  // Real-time subscription for user_settings changes
  useEffect(() => {
    if (!user?.id || !session) return;

    console.log('📡 [Subscription] Setting up subscription for user settings');
    const supabase = createClerkSupabaseClient(() => session.getToken());

    const filter = `clerk_user_id=eq.${user.id}`;

    const channel = supabase
      .channel('user-settings-changes')
      .on('postgres_changes', {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'user_settings',
        filter,
      }, (payload) => {
        console.log('📡 [Subscription] Settings change detected:', payload);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          console.log('📡 [Subscription] Updating settings from subscription');
          setSettings(payload.new as UserSettings);
        } else if (payload.eventType === 'DELETE') {
          console.log('📡 [Subscription] Settings deleted');
          setSettings(null);
        }
      })
      .subscribe((status, err) => {
        console.log('📡 [Subscription] Subscription status:', status);
        if (err) {
          console.error('📡 [Subscription] Subscription error:', err);
        }
      });

    return () => {
      console.log('📡 [Subscription] Unsubscribing from user settings');
      supabase.removeChannel(channel);
    };
  }, [user?.id, session]);

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
