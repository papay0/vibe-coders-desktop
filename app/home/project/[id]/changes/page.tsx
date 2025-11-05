'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSession } from '@clerk/nextjs';
import { createClerkSupabaseClient, Project } from '@/lib/supabase';
import { SetBreadcrumbName } from '@/components/breadcrumb-context';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, FilePlus, FileX, FileEdit, Loader2, RefreshCw } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';

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
  unifiedDiff: string;
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
          await loadGitStatus(data.project_path);
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Changes</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {gitStatus?.totalFiles || 0} file{gitStatus?.totalFiles !== 1 ? 's' : ''} changed
              </p>
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
          <div className="w-80 border-r border-gray-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3e3e42]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Changed Files</h3>
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
                          ? 'bg-teal-100 dark:bg-[#37373d] border border-teal-300 dark:border-[#007acc]'
                          : 'hover:bg-gray-100 dark:hover:bg-[#2a2d2e]'
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
          <div className="flex-1 overflow-hidden bg-white dark:bg-[#1e1e1e]">
            {loadingDiff ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : fileDiff && selectedFile ? (
              <div className="h-full flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-[#3e3e42]">
                  <h3 className="font-mono text-sm text-gray-700 dark:text-gray-200">
                    {fileDiff.fileName}
                  </h3>
                </div>
                <div className="flex-1">
                  <DiffView
                    oldContent={fileDiff.oldContent}
                    newContent={fileDiff.newContent}
                    fileName={fileDiff.fileName}
                  />
                </div>
              </div>
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

// Detect language from file extension
function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'html': 'html',
    'xml': 'xml',
    'py': 'python',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'dart': 'dart',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'md': 'markdown',
    'graphql': 'graphql',
    'vue': 'vue',
    'svelte': 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}

// Monaco DiffEditor component
function DiffView({ oldContent, newContent, fileName }: { oldContent: string; newContent: string; fileName: string }) {
  const [isDark, setIsDark] = useState(false);
  const language = getLanguageFromFileName(fileName);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <DiffEditor
      original={oldContent}
      modified={newContent}
      language={language}
      theme={isDark ? 'vs-dark' : 'light'}
      height="calc(100vh - 16rem)"
      options={{
        readOnly: true,
        renderSideBySide: true,
        enableSplitViewResizing: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 13,
        wordWrap: 'off',
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        diffWordWrap: 'off',
        ignoreTrimWhitespace: false,
        renderIndicators: true,
        originalEditable: false,
        automaticLayout: true,
      }}
    />
  );
}
