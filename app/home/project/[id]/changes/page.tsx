'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, FileText, FilePlus, FileX, FileEdit, Loader2, RefreshCw } from 'lucide-react';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';

interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked';
  additions?: number;
  deletions?: number;
}

interface GitDiffResponse {
  files: GitFileStatus[];
  totalFiles: number;
  hasChanges: boolean;
  error?: string;
}

interface GitFileDiffResponse {
  oldContent: string;
  newContent: string;
  fileName: string;
  language: string;
  error?: string;
}

export default function ChangesPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const { session } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitDiffResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<GitFileDiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

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
          await loadGitStatus(data.project_path);
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

  const loadGitStatus = async (projectPath: string) => {
    try {
      const response = await fetch('/api/git-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath }),
      });

      const data: GitDiffResponse = await response.json();
      setGitStatus(data);

      // Auto-select first file if available
      if (data.files.length > 0) {
        setSelectedFile(data.files[0].path);
        await loadFileDiff(projectPath, data.files[0].path);
      }
    } catch (error) {
      console.error('Error loading git status:', error);
    }
  };

  const loadFileDiff = async (projectPath: string, filePath: string) => {
    setLoadingDiff(true);
    try {
      const response = await fetch('/api/git-file-diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath, filePath }),
      });

      const data: GitFileDiffResponse = await response.json();
      setFileDiff(data);
    } catch (error) {
      console.error('Error loading file diff:', error);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    if (project) {
      loadFileDiff(project.project_path, filePath);
    }
  };

  const handleRefresh = () => {
    if (project) {
      loadGitStatus(project.project_path);
    }
  };

  const getFileIcon = (status: string) => {
    switch (status) {
      case 'added':
      case 'untracked':
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case 'deleted':
        return <FileX className="h-4 w-4 text-red-500" />;
      case 'modified':
        return <FileEdit className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4" />;
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
          <ArrowLeft className="mr-2 h-4 w-4" />
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
        <div className="border-b bg-white dark:bg-slate-900 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/home/project/${params.id}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Changes</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {gitStatus?.totalFiles || 0} file{gitStatus?.totalFiles !== 1 ? 's' : ''} changed
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File List Sidebar */}
          <div className="w-80 border-r bg-gray-50 dark:bg-slate-900">
            <div className="p-4 border-b bg-white dark:bg-slate-800">
              <h3 className="font-semibold">Changed Files</h3>
            </div>
            <ScrollArea className="h-[calc(100vh-12rem)]">
              {gitStatus?.hasChanges ? (
                <div className="p-2 space-y-1">
                  {gitStatus.files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => handleFileSelect(file.path)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedFile === file.path
                          ? 'bg-teal-100 dark:bg-teal-900/30 border border-teal-300 dark:border-teal-700'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {getFileIcon(file.status)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{file.path}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="text-green-600 dark:text-green-400">+{file.additions || 0}</span>
                          {' / '}
                          <span className="text-red-600 dark:text-red-400">-{file.deletions || 0}</span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No changes detected</p>
                  <p className="text-xs mt-2">
                    {gitStatus?.error || 'Make some changes to your project to see them here'}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900">
            {loadingDiff ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : fileDiff && selectedFile ? (
              <ScrollArea className="h-full">
                <div className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {fileDiff.fileName}
                    </h3>
                  </div>

                  {/* Simple line-by-line diff display */}
                  <div className="rounded-lg border dark:border-slate-700 overflow-hidden font-mono text-sm">
                    <DiffView oldContent={fileDiff.oldContent} newContent={fileDiff.newContent} />
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Select a file to view changes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Simple diff component using react-diff-view
function DiffView({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const [viewType, setViewType] = useState<'split' | 'unified'>('split');

  // Create a unified diff format that react-diff-view can parse
  const createUnifiedDiff = (oldStr: string, newStr: string): string => {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');

    // Simple diff: show all old lines as deletions, all new lines as additions
    let diff = '--- old\n+++ new\n@@ -1,' + oldLines.length + ' +1,' + newLines.length + ' @@\n';

    oldLines.forEach(line => {
      diff += '-' + line + '\n';
    });

    newLines.forEach(line => {
      diff += '+' + line + '\n';
    });

    return diff;
  };

  try {
    const diffText = createUnifiedDiff(oldContent, newContent);
    const files = parseDiff(diffText);

    if (files.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500">
          No differences detected
        </div>
      );
    }

    return (
      <div>
        <div className="flex gap-2 p-2 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
          <Button
            variant={viewType === 'split' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewType('split')}
          >
            Split View
          </Button>
          <Button
            variant={viewType === 'unified' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewType('unified')}
          >
            Unified View
          </Button>
        </div>
        {files.map((file, idx) => (
          <Diff key={idx} viewType={viewType} diffType={file.type} hunks={file.hunks}>
            {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
          </Diff>
        ))}
      </div>
    );
  } catch (error) {
    console.error('Error parsing diff:', error);
    return (
      <div className="p-8 text-center text-red-500">
        Error displaying diff
      </div>
    );
  }
}
