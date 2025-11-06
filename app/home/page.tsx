'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Plus, Loader2, Sparkles, Smartphone, Trash2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async (signal?: AbortSignal) => {
    if (!user || !session) return;

    setLoading(true);
    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      // Check if request was aborted
      if (signal?.aborted) return;

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      if (signal?.aborted) return; // Ignore errors from aborted requests
      console.error('Error loading projects:', error);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user.id - session is captured in closure and checked at runtime

  useEffect(() => {
    const abortController = new AbortController();
    loadProjects(abortController.signal);

    // Cleanup: abort the request if component unmounts or effect re-runs
    return () => {
      abortController.abort();
    };
  }, [loadProjects]);

  const handleDeleteProject = async (projectId: string) => {
    if (!session || !confirm('Are you sure you want to remove this project?')) return;

    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project');
    }
  };

  const getProjectIcon = (type: Project['project_type']) => {
    switch (type) {
      case 'import':
        return <FolderOpen className="h-5 w-5" />;
      case 'web':
        return <Sparkles className="h-5 w-5" />;
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const getProjectTypeLabel = (type: Project['project_type']) => {
    switch (type) {
      case 'import':
        return 'Imported Project';
      case 'web':
        return 'Web App';
      case 'mobile':
        return 'Mobile App';
    }
  };

  const getDisplayName = (project: Project) => {
    if (project.project_name.includes('/') || project.project_name.includes('\\')) {
      return project.project_name.split(/[\\/\\]/).filter(Boolean).pop() || project.project_name;
    }
    return project.project_name;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Welcome to Vibe Coders</h1>
        <p className="text-muted-foreground mt-1">
          Build amazing projects with AI assistance
        </p>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Add Project Card */}
          <Card
            className="cursor-pointer hover:border-teal-600 transition-colors border-dashed"
            onClick={() => router.push('/home/add-project')}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900 p-4 mb-4">
                <Plus className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="font-semibold mb-2">Add Project</h3>
              <p className="text-sm text-muted-foreground">
                Import or create a new project
              </p>
            </CardContent>
          </Card>

          {/* Project Cards */}
          {projects.map((project) => (
            <Card
              key={project.id}
              className="hover:border-teal-600 transition-colors cursor-pointer"
              onClick={() => router.push(`/home/project/${project.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-teal-100 dark:bg-teal-900 p-2">
                      {getProjectIcon(project.project_type)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{getDisplayName(project)}</CardTitle>
                      <CardDescription className="text-xs">
                        {getProjectTypeLabel(project.project_type)}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground truncate" title={project.project_path}>
                  {project.project_path}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
