'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Home, FolderOpen } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-6 max-w-xl px-4">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-teal-600 dark:text-teal-500">404</h1>
          <h2 className="text-3xl font-semibold tracking-tight">Page Not Found</h2>
          <p className="text-lg text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => router.push('/home')} size="lg">
            <Home className="mr-2 h-5 w-5" />
            Go to Home
          </Button>
          <Button onClick={() => router.push('/home/projects')} variant="outline" size="lg">
            <FolderOpen className="mr-2 h-5 w-5" />
            View Projects
          </Button>
        </div>
      </div>
    </div>
  );
}
