'use client';

import { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, FilePlus, FileX, FileEdit, Loader2 } from 'lucide-react';

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

interface DiffViewerProps {
  gitStatus: GitDiffResponse | null;
  selectedFile: string | null;
  fileDiff: GitFileDiffResponse | null;
  loadingDiff: boolean;
  onFileSelect: (filePath: string) => void;
}

export function DiffViewer({
  gitStatus,
  selectedFile,
  fileDiff,
  loadingDiff,
  onFileSelect,
}: DiffViewerProps) {
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

  return (
    <div className="flex h-full">
      {/* File List Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-[#3e3e42] bg-white dark:bg-[#252526]">
        <div className="p-4 border-b border-gray-200 dark:border-[#3e3e42]">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Changed Files</h3>
        </div>
        <ScrollArea className="h-[calc(100%-4rem)]">
          {gitStatus?.hasChanges ? (
            <div className="p-2 space-y-1">
              {gitStatus.files.map((file) => (
                <button
                  key={file.path}
                  onClick={() => onFileSelect(file.path)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selectedFile === file.path
                      ? 'bg-teal-100 dark:bg-[#37373d] border border-teal-300 dark:border-[#007acc]'
                      : 'hover:bg-gray-100 dark:hover:bg-[#2a2d2e]'
                  }`}
                >
                  {getFileIcon(file.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">{file.path}</p>
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
      height="100%"
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
