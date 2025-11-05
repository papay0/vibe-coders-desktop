'use client';

import { useEffect, useState } from 'react';
import { useUser, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { GitCommitTest } from '@/components/git-commit-test';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, FolderOpen, Sparkles, Smartphone, Loader2, Trash2 } from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    if (!user || !session) return;

    setLoading(true);
    try {
      const supabase = createClerkSupabaseClient(() => session.getToken());

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('clerk_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user, session]);

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
    // If the name looks like a path, extract just the folder name
    if (project.project_name.includes('/') || project.project_name.includes('\\')) {
      return project.project_name.split(/[\/\\]/).filter(Boolean).pop() || project.project_name;
    }
    return project.project_name;
  };

  return (
    <>
      <SetBreadcrumbName name="Projects" />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your projects
          </p>
        </div>
        <Button onClick={() => router.push('/home/add-project')} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2 text-lg">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Get started by importing an existing project or creating a new one with AI assistance
            </p>
            <Button onClick={() => router.push('/home/add-project')} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    </>
  );
}
