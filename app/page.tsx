'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { SignIn } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/home');
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-4xl">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Value proposition */}
          <div className="space-y-6">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Vibe Coders
              </h1>
              <p className="mt-3 text-xl text-gray-700 dark:text-gray-300">
                Code with AI, no terminal fear
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Build amazing projects without touching the command line. Vibe Coders brings AI-powered development to your desktop, handling all the technical complexity while you focus on creating.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Git made simple</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered commits and version control</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Project scaffolding</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Start websites, mobile apps, and more instantly</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">Your keys, your control</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Use your own API keys or our managed service</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Sign in */}
          <div className="flex justify-center lg:justify-end">
            <SignIn routing="path" path="/" signUpUrl="/sign-up" />
          </div>
        </div>
      </div>
    </div>
  );
}
