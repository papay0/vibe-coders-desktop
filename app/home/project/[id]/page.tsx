'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Square, Globe, X, GitCompare, Zap } from 'lucide-react';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    // Don't reload if we've already loaded the project
    if (!user || !session || !params.id || hasLoadedOnce) return;

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
          setHasLoadedOnce(true); // Mark as loaded to prevent reload on tab switch
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [user, session, params.id, hasLoadedOnce]);

  const getDisplayName = (proj: Project) => {
    // If the name looks like a path, extract just the folder name
    if (proj.project_name.includes('/') || proj.project_name.includes('\\')) {
      return proj.project_name.split(/[\/\\]/).filter(Boolean).pop() || proj.project_name;
    }
    return proj.project_name;
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
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Button
                onClick={() => router.push(`/home/project/${project.id}/action?type=start-dev-server`)}
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
                onClick={() => router.push(`/home/project/${project.id}/action?type=kill-server`)}
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

              <Button
                onClick={() => router.push(`/home/project/${project.id}/changes`)}
                className="gap-2 h-auto py-4 flex-col items-start"
                variant="outline"
              >
                <div className="flex items-center gap-2 w-full">
                  <GitCompare className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">
                    {advancedMode ? 'View Changes' : 'See What Changed'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground text-left">
                  {advancedMode
                    ? 'View git diff and see what the AI changed in your project'
                    : 'See what was changed in your code'
                  }
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
