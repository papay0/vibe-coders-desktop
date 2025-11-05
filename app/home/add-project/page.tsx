'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { FolderOpen, Sparkles, Smartphone, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { createClerkSupabaseClient } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AIProgressChat } from '@/components/ai-progress-chat';

type FlowStep = 'select' | 'import' | 'create-web' | 'configure-web' | 'creating' | 'create-mobile';

interface AIMessage {
  content: string;
  type: 'text' | 'tool' | 'output';
}

export default function AddProjectPage() {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [step, setStep] = useState<FlowStep>('select');
  const [loading, setLoading] = useState(false);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const hasAutoOpened = useRef(false);

  const handleImportProject = async () => {
    setLoading(true);
    try {
      // Call backend API to open native folder picker
      const response = await fetch('/api/select-folder', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'Folder selection cancelled') {
          // User cancelled, just return without error
          return;
        }
        throw new Error(data.error || 'Failed to select folder');
      }

      if (data.path) {
        setProjectPath(data.path);

        // Only set the name for import flow, not for configure-web
        if (step === 'import') {
          setProjectName(data.name || data.path.split(/[\/\\]/).pop() || '');
        }
      }
    } catch (err) {
      console.error('Error selecting folder:', err);
      alert('Failed to select folder: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Auto-open file picker when entering import step (only once)
  useEffect(() => {
    if (step === 'import' && !hasAutoOpened.current && !projectPath) {
      hasAutoOpened.current = true;
      // Small delay to ensure the step transition completes
      setTimeout(() => {
        handleImportProject();
      }, 300);
    }

    // Reset when going back to select
    if (step === 'select') {
      hasAutoOpened.current = false;
    }
  }, [step]);

  const handleSaveProject = async (projectType: 'import' | 'web' | 'mobile') => {
    if (!user || !session) return;
    if (!projectName.trim() || !projectPath.trim()) {
      alert('Please provide a project name and path');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { error } = await supabase
        .from('projects')
        .insert({
          clerk_user_id: user.id,
          project_name: projectName.trim(),
          project_path: projectPath.trim(),
          project_type: projectType,
        });

      if (error) throw error;

      // Navigate back to home and refresh
      router.push('/home');
      router.refresh();
    } catch (error) {
      console.error('Error saving project:', error);
      alert('Failed to save project: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'select') {
      router.push('/home');
    } else if (step === 'configure-web') {
      setStep('create-web');
      setProjectPath('');
      setProjectName('');
    } else {
      setStep('select');
      setProjectPath('');
      setProjectName('');
    }
  };

  const handleCreateWebProject = async () => {
    if (!user || !session || !projectName.trim() || !projectPath.trim()) {
      alert('Please provide a project name and path');
      return;
    }

    // Navigate to creating step
    setStep('creating');
    setCreatingProject(true);
    setAiMessages([]);

    try {
      // Stream events from the API
      const response = await fetch('/api/create-web-project-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName.trim(),
          path: projectPath.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'message') {
                  setAiMessages(prev => [...prev, {
                    content: parsed.content,
                    type: parsed.messageType || 'text',
                  }]);
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.content);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Save to database
      const supabase = createClerkSupabaseClient(() => session.getToken());

      // Remove trailing slash from projectPath and join properly
      const cleanPath = projectPath.replace(/\/+$/, '');
      const fullPath = `${cleanPath}/${projectName}`;

      const { data: projectData, error } = await supabase
        .from('projects')
        .insert({
          clerk_user_id: user.id,
          project_name: projectName.trim(),
          project_path: fullPath,
          project_type: 'web',
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate to the new project
      router.push(`/home/project/${projectData.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setStep('configure-web');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleNext = () => {
    if (step === 'import') {
      handleSaveProject('import');
    } else if (step === 'configure-web') {
      handleCreateWebProject();
    }
  };

  const canProceed = step === 'select' || (projectName.trim() && projectPath.trim());

  return (
    <>
      <SetBreadcrumbName name="Add Project" />

      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-4 px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-3">
              {step === 'select' && 'Add a Project'}
              {step === 'import' && 'Import Existing Project'}
              {step === 'create-web' && 'Choose Project Type'}
              {step === 'configure-web' && 'Configure Web Application'}
              {step === 'creating' && 'Creating Your Project'}
              {step === 'create-mobile' && 'Create Mobile App'}
            </h1>
            <p className="text-muted-foreground text-xl">
              {step === 'select' && 'Choose how you want to add your project'}
              {step === 'import' && 'Select a folder from your computer'}
              {step === 'create-web' && 'Select the type of application you want to build'}
              {step === 'configure-web' && 'Set up your new web application with Next.js'}
              {step === 'creating' && 'Watch as AI sets up your project'}
              {step === 'create-mobile' && 'Mobile app creation coming soon'}
            </p>

            {/* Progress Indicator */}
            {step !== 'create-web' && step !== 'creating' && (
              <div className="flex items-center gap-3 mt-8 max-w-md mx-auto">
                <div className={`h-2 rounded-full flex-1 transition-colors ${step === 'select' ? 'bg-teal-600' : 'bg-teal-600'}`} />
                <div className={`h-2 rounded-full flex-1 transition-colors ${step !== 'select' && step !== 'create-web' ? 'bg-teal-600' : 'bg-muted'}`} />
              </div>
            )}
          </div>
        </div>

        {/* Content Area - Flex container, no scroll here */}
        <div className="flex-1 overflow-hidden pb-6">
          {step === 'creating' ? (
            // Creating step - full height container
            <div className="h-full px-6">
              <AIProgressChat
                messages={aiMessages}
                isLoading={creatingProject}
                title="AI is setting up your project..."
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full overflow-y-auto">
              <div className="flex flex-col items-center w-full">
                {/* Selection Step */}
                {step === 'select' && (
              <div className="grid gap-6 md:grid-cols-2 w-full max-w-4xl">
                <Card
                  className="cursor-pointer hover:border-teal-600 hover:shadow-lg transition-all"
                  onClick={() => setStep('import')}
                >
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-2xl bg-teal-100 dark:bg-teal-900 p-6 mb-6">
                      <FolderOpen className="h-12 w-12 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">Import Existing Project</h3>
                    <p className="text-muted-foreground max-w-xs">
                      Select a folder from your computer to work with existing code
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer hover:border-purple-600 hover:shadow-lg transition-all"
                  onClick={() => setStep('create-web')}
                >
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="rounded-2xl bg-purple-100 dark:bg-purple-900 p-6 mb-6">
                      <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold text-xl mb-2">Create New Project</h3>
                    <p className="text-muted-foreground max-w-xs">
                      Start fresh with AI-powered project scaffolding
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Import Step */}
            {step === 'import' && (
              <div className="w-full max-w-3xl space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="project-name" className="text-base font-semibold">
                    Project Name
                  </Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome Project"
                    className="h-12 text-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    Give your project a memorable name
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="project-path" className="text-base font-semibold">
                    Project Location
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="project-path"
                      value={projectPath}
                      onChange={(e) => setProjectPath(e.target.value)}
                      placeholder="Click Browse to select your project folder..."
                      className="flex-1 h-12 text-lg font-mono"
                      readOnly
                    />
                    <Button
                      onClick={handleImportProject}
                      variant="outline"
                      className="h-12 px-6"
                      disabled={loading}
                    >
                      <FolderOpen className="mr-2 h-5 w-5" />
                      {loading ? 'Opening...' : 'Browse'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    A native folder picker will open. The full path will be automatically captured.
                  </p>
                </div>
              </div>
            )}

            {/* Create Web App Step */}
            {step === 'create-web' && (
              <div className="w-full max-w-4xl">
                <div className="grid gap-6 md:grid-cols-2">
                  <Card
                    className="cursor-pointer hover:border-purple-600 hover:shadow-lg transition-all"
                    onClick={() => setStep('configure-web')}
                  >
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="rounded-2xl bg-purple-100 dark:bg-purple-900 p-6 mb-6">
                        <Sparkles className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="font-semibold text-xl mb-2">Web Application</h3>
                      <p className="text-muted-foreground max-w-xs">
                        Create a new web app with Next.js, TypeScript, and Tailwind CSS
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="opacity-50 cursor-not-allowed border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="rounded-2xl bg-muted p-6 mb-6">
                        <Smartphone className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-xl mb-2">Mobile Application</h3>
                      <p className="text-muted-foreground max-w-xs mb-3">
                        React Native and Flutter support
                      </p>
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        COMING SOON
                      </span>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Configure Web App Step */}
            {step === 'configure-web' && (
              <div className="w-full max-w-3xl space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="web-project-name" className="text-base font-semibold">
                    Project Name
                  </Label>
                  <Input
                    id="web-project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-web-app"
                    className="h-12 text-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    This will be used as the folder name
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="web-project-path" className="text-base font-semibold">
                    Project Location
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="web-project-path"
                      value={projectPath}
                      onChange={(e) => setProjectPath(e.target.value)}
                      placeholder="Click Browse to select where to create the project..."
                      className="flex-1 h-12 text-lg font-mono"
                      readOnly
                    />
                    <Button
                      onClick={handleImportProject}
                      variant="outline"
                      className="h-12 px-6"
                      disabled={loading}
                    >
                      <FolderOpen className="mr-2 h-5 w-5" />
                      {loading ? 'Opening...' : 'Browse'}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select the parent directory where your new project folder will be created.
                  </p>
                </div>
              </div>
            )}

            {/* Create Mobile App Step - Coming Soon */}
            {step === 'create-mobile' && (
              <div className="w-full max-w-3xl">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-2xl bg-muted p-8 mb-6">
                    <Smartphone className="h-16 w-16 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-2xl mb-3">Mobile App Creation Coming Soon</h3>
                  <p className="text-muted-foreground max-w-md text-lg">
                    We're working on adding React Native and Flutter project templates. Stay tuned for updates!
                  </p>
                </div>
              </div>
            )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step !== 'creating' && (
          <div className="border-t bg-background pt-4 pb-4 px-6 flex-shrink-0">
            <div className="flex justify-between items-center max-w-3xl mx-auto">
              <Button
                variant="ghost"
                size="lg"
                onClick={handleBack}
                className="gap-2"
              >
                <ArrowLeft className="h-5 w-5" />
                {step === 'select' ? 'Cancel' : 'Back'}
              </Button>

            {step === 'import' && (
              <Button
                size="lg"
                onClick={handleNext}
                disabled={loading || !canProceed}
                className="gap-2 min-w-[160px]"
              >
                {loading ? (
                  'Processing...'
                ) : (
                  <>
                    Import Project
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            )}

            {step === 'configure-web' && (
              <Button
                size="lg"
                onClick={handleNext}
                disabled={creatingProject || !canProceed}
                className="gap-2 min-w-[160px]"
              >
                {creatingProject ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Project...
                  </>
                ) : (
                  <>
                    Create Project
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </Button>
            )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
