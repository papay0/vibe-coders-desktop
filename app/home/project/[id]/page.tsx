'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FolderOpen, Loader2, Play, Square, Zap, Globe, X } from 'lucide-react';
import { AIProgressChat } from '@/components/ai-progress-chat';

interface AIMessage {
  content: string;
  type: 'text' | 'tool' | 'output';
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessages, setActionMessages] = useState<AIMessage[]>([]);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    if (!user || !session || !params.id) return;

    async function loadProject() {
      setLoading(true);
      try {
        const supabase = createClerkSupabaseClient(() => session!.getToken());

        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', params.id)
          .eq('clerk_user_id', user!.id)
          .single();

        if (error) throw error;

        if (!data) {
          setError('Project not found');
        } else {
          setProject(data);
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [user, session, params.id]);

  const getDisplayName = (proj: Project) => {
    // If the name looks like a path, extract just the folder name
    if (proj.project_name.includes('/') || proj.project_name.includes('\\')) {
      return proj.project_name.split(/[\/\\]/).filter(Boolean).pop() || proj.project_name;
    }
    return proj.project_name;
  };

  const executeAction = async (action: 'start-dev-server' | 'kill-server', actionName: string) => {
    if (!project) return;

    setCurrentAction(actionName);
    setActionDialogOpen(true);
    setActionInProgress(true);
    setActionMessages([]);

    try {
      const response = await fetch('/api/execute-action-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          params: {
            projectPath: project.project_path,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute action');
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
                  setActionMessages(prev => [...prev, {
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
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <>
        <SetBreadcrumbName name="Loading..." />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <SetBreadcrumbName name="Error" />
        <div className="space-y-6">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="text-red-600 dark:text-red-400">
                {error || 'Project not found'}
              </CardTitle>
              <CardDescription>
                The project you're looking for doesn't exist or you don't have access to it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/home')}>
                Go to Projects
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SetBreadcrumbName name={getDisplayName(project)} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{getDisplayName(project)}</h1>
            <p className="text-muted-foreground mt-1">
              {project.project_type === 'import' && 'Imported Project'}
              {project.project_type === 'web' && 'Web Application'}
              {project.project_type === 'mobile' && 'Mobile Application'}
            </p>
          </div>

          {/* Advanced Mode Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="advanced-mode"
              checked={advancedMode}
              onCheckedChange={setAdvancedMode}
            />
            <Label htmlFor="advanced-mode" className="text-sm text-muted-foreground cursor-pointer">
              Advanced Mode
            </Label>
          </div>
        </div>

        {/* Project Info Card - Compact */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Location</p>
                <p className="font-mono text-xs mt-1 truncate" title={project.project_path}>
                  {project.project_path}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Type</p>
                <p className="text-xs mt-1">
                  {project.project_type === 'import' && 'Imported'}
                  {project.project_type === 'web' && 'Web App'}
                  {project.project_type === 'mobile' && 'Mobile App'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Created</p>
                <p className="text-xs mt-1">
                  {new Date(project.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {advancedMode ? 'Quick Actions' : 'Actions'}
            </CardTitle>
            <CardDescription>
              {advancedMode
                ? 'AI-powered actions to help you work with your project'
                : 'Work with your project easily'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <Button
                onClick={() => executeAction('start-dev-server', advancedMode ? 'Start Dev Server' : 'Open Website Preview')}
                disabled={actionInProgress}
                className="gap-2 h-auto py-4 flex-col items-start"
                variant="outline"
              >
                <div className="flex items-center gap-2 w-full">
                  {advancedMode ? (
                    <Play className="h-5 w-5 text-green-600" />
                  ) : (
                    <Globe className="h-5 w-5 text-green-600" />
                  )}
                  <span className="font-semibold">
                    {advancedMode ? 'Start Dev Server' : 'Open Website'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {advancedMode
                    ? 'Install dependencies, start development server, and open in browser'
                    : 'Preview your website in the browser'
                  }
                </span>
              </Button>

              <Button
                onClick={() => executeAction('kill-server', advancedMode ? 'Stop Dev Server' : 'Close Website Preview')}
                disabled={actionInProgress}
                className="gap-2 h-auto py-4 flex-col items-start"
                variant="outline"
              >
                <div className="flex items-center gap-2 w-full">
                  {advancedMode ? (
                    <Square className="h-5 w-5 text-red-600" />
                  ) : (
                    <X className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-semibold">
                    {advancedMode ? 'Stop Server' : 'Close Website'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {advancedMode
                    ? 'Find and stop any running development servers for this project'
                    : 'Stop the website preview'
                  }
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Progress Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{currentAction}</DialogTitle>
            <DialogDescription>
              Watch as AI executes the action for your project
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <AIProgressChat
              messages={actionMessages}
              isLoading={actionInProgress}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
