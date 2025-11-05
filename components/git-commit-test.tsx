'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GitCommit } from 'lucide-react';

export function GitCommitTest() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleGitCommit = async () => {
    setLoading(true);
    setError('');
    setOutput('');

    try {
      const response = await fetch('/api/git-commit', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate commit message');
      }

      setOutput(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Git Commit Test</CardTitle>
        <CardDescription>
          Test the AI-powered commit message generation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleGitCommit}
          disabled={loading}
          className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
        >
          <GitCommit className="mr-2 h-4 w-4" />
          {loading ? 'Generating...' : 'Generate Commit Message'}
        </Button>

        {output && (
          <div className="mt-4 p-4 bg-muted rounded-md border">
            <h3 className="text-sm font-semibold mb-2">Output:</h3>
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {output}
            </pre>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-destructive/10 rounded-md border border-destructive/20">
            <h3 className="text-sm font-semibold text-destructive mb-2">
              Error:
            </h3>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
