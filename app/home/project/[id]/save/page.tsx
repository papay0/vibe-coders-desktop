'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Check } from 'lucide-react';

export default function SavePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (!user || !session || !params.id || hasExecutedRef.current) return;

    hasExecutedRef.current = true;

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
          // Start generating commit message
          generateCommitMessage(data.project_path);
        }
      } catch (error) {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [user, session, params.id]);

  const generateCommitMessage = async (projectPath: string) => {
    setGenerating(true);
    try {
      const response = await fetch('/api/generate-commit-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectPath }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate commit message');
      }

      const data = await response.json();
      setTitle(data.title || '');
      setDescription(data.description || '');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate commit message');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!project) return;

    setPublishing(true);
    setError(null);

    try {
      const response = await fetch('/api/commit-and-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath: project.project_path,
          title,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish changes');
      }

      setPublished(true);
      setTimeout(() => {
        router.push(`/home/project/${project.id}`);
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to publish changes');
    } finally {
      setPublishing(false);
    }
  };

  const getDisplayName = (proj: Project) => {
    if (proj.project_name.includes('/') || proj.project_name.includes('\\')) {
      return proj.project_name.split(/[\/\\]/).filter(Boolean).pop() || proj.project_name;
    }
    return proj.project_name;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => router.push('/home/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">Project not found</p>
        <Button onClick={() => router.push('/home/projects')}>
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <>
      <SetBreadcrumbName name={getDisplayName(project)} />
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-[#3e3e42] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Save & Publish Changes</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review and edit your commit message before publishing
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/home/project/${project.id}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {generating ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                    <p className="text-sm text-muted-foreground">
                      Analyzing changes and generating commit message...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : published ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-lg font-semibold">Changes Published!</p>
                    <p className="text-sm text-muted-foreground">
                      Redirecting back to project...
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Commit Message</CardTitle>
                  <CardDescription>
                    Edit the generated commit message if needed, then publish your changes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="feat: add new feature"
                      className="font-mono"
                      disabled={publishing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use conventional commits format (feat:, fix:, docs:, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Detailed description of changes..."
                      rows={6}
                      disabled={publishing}
                    />
                    <p className="text-xs text-muted-foreground">
                      Explain what changed and why
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handlePublish}
                      disabled={!title || publishing}
                      className="flex-1"
                    >
                      {publishing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Publishing...
                        </>
                      ) : (
                        'Publish Changes'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => generateCommitMessage(project.project_path)}
                      disabled={generating || publishing}
                    >
                      Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
