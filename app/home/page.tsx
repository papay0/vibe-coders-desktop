'use client';

import { GitCommitTest } from '@/components/git-commit-test';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, FolderPlus } from 'lucide-react';

export default function HomePage() {

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage your projects
        </p>
      </div>

      {/* Quick Start - Coming Soon */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Start a new project</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Create websites, mobile apps, or backend services with AI assistance
            </p>
            <Button disabled className="gap-2">
              <span>Coming Soon</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <FolderPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Open existing project</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Connect to a Git repository or local folder
            </p>
            <Button disabled className="gap-2">
              <span>Coming Soon</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Developer Tools
          </span>
        </div>
      </div>

      {/* Current Functionality */}
      <GitCommitTest />
    </div>
  );
}
