'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { UserSettings } from '@/lib/supabase';

interface SubscriptionSettingsProps {
  settings: UserSettings | null;
  loading: boolean;
  onSave: (apiMode: 'premium' | 'byok', apiKey: string) => Promise<void>;
}

const API_KEY_STORAGE_KEY = 'vibe_coders_anthropic_api_key';

export function SubscriptionSettings({ settings, loading, onSave }: SubscriptionSettingsProps) {
  const [apiMode, setApiMode] = useState<'premium' | 'byok'>(settings?.api_mode || 'premium');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  // Sync apiMode when settings change
  useEffect(() => {
    if (settings) {
      setApiMode(settings.api_mode);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(apiMode, apiKey);
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Plan</CardTitle>
        <CardDescription>
          Choose how you want to use Vibe Coders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            <RadioGroup value={apiMode} onValueChange={(v) => setApiMode(v as any)}>
              <div className="flex items-center space-x-2 border rounded-lg p-4">
                <RadioGroupItem value="premium" id="premium" />
                <Label htmlFor="premium" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Premium Subscription</div>
                  <div className="text-sm text-muted-foreground">
                    Unlimited usage with our managed API
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 border rounded-lg p-4">
                <RadioGroupItem value="byok" id="byok" />
                <Label htmlFor="byok" className="flex-1 cursor-pointer">
                  <div className="font-semibold">Bring Your Own Key (BYOK)</div>
                  <div className="text-sm text-muted-foreground">
                    Use your own API key (Anthropic, OpenAI, etc.)
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {apiMode === 'byok' && (
              <div className="space-y-2">
                <Label htmlFor="api-key">Anthropic API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-ant-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    Anthropic Console
                  </a>
                </p>
              </div>
            )}

            <Button
              onClick={handleSave}
              disabled={saving || (apiMode === 'byok' && !apiKey)}
              className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
