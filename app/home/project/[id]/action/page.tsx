'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { AIProgressChat } from '@/components/ai-progress-chat';

interface AIMessage {
  content: string;
  type: 'text' | 'tool' | 'output';
}

export default function ActionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionMessages, setActionMessages] = useState<AIMessage[]>([]);
  const [actionType, setActionType] = useState<string>('');
  const [actionTitle, setActionTitle] = useState<string>('');
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (!user || !session || !params.id || hasExecutedRef.current) return;

    // Mark as executed IMMEDIATELY to prevent race conditions
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

          // Get action from search params
          const action = searchParams.get('type');
          if (action) {
            setActionType(action);

            // Set action title based on type
            if (action === 'start-dev-server') {
              setActionTitle('Open Website Preview');
            } else if (action === 'kill-server') {
              setActionTitle('Close Website Preview');
            }

            // Start executing the action
            executeAction(data, action as 'start-dev-server' | 'kill-server');
          }
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [user, session, params.id, searchParams]);

  const executeAction = async (proj: Project, action: 'start-dev-server' | 'kill-server') => {
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
            projectPath: proj.project_path,
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
      setActionMessages(prev => [...prev, {
        content: 'Failed to execute action: ' + (error instanceof Error ? error.message : 'Unknown error'),
        type: 'text',
      }]);
    } finally {
      setActionInProgress(false);
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

  if (error || !project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || 'Project not found'}</p>
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{actionTitle}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Watch as AI executes the action for your project
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => router.push(`/home/project/${project.id}`)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* AI Progress */}
        <div className="flex-1 overflow-hidden p-6">
          <AIProgressChat
            messages={actionMessages}
            isLoading={actionInProgress}
          />
        </div>
      </div>
    </>
  );
}
