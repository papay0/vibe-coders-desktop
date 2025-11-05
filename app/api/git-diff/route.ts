import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export const maxDuration = 30;

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

function parseGitStatus(statusOutput: string): GitFileStatus[] {
  const files: GitFileStatus[] = [];
  const lines = statusOutput.trim().split('\n').filter(line => line.trim());

  for (const line of lines) {
    if (line.length < 2) continue;

    const statusCode = line.substring(0, 2);
    const filePath = line.substring(3);

    let status: GitFileStatus['status'] = 'modified';

    // Git status codes: https://git-scm.com/docs/git-status#_short_format
    if (statusCode.includes('M')) status = 'modified';
    else if (statusCode.includes('A')) status = 'added';
    else if (statusCode.includes('D')) status = 'deleted';
    else if (statusCode.includes('R')) status = 'renamed';
    else if (statusCode.includes('??')) status = 'untracked';

    files.push({
      path: filePath,
      status,
    });
  }

  return files;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    // Validate that the path exists and is a directory
    const resolvedPath = path.resolve(projectPath);

    try {
      // Check if it's a git repository
      execSync('git rev-parse --git-dir', {
        cwd: resolvedPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      return NextResponse.json(
        {
          files: [],
          totalFiles: 0,
          hasChanges: false,
          error: 'Not a git repository',
        } as GitDiffResponse,
        { status: 200 }
      );
    }

    // Get git status (staged and unstaged files)
    const statusOutput = execSync('git status --porcelain', {
      cwd: resolvedPath,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const files = parseGitStatus(statusOutput);

    // Get stats for each file (additions/deletions)
    for (const file of files) {
      if (file.status === 'untracked' || file.status === 'added') {
        // For new files, count total lines
        try {
          const fileContent = execSync(`git diff --cached -- "${file.path}"`, {
            cwd: resolvedPath,
            encoding: 'utf8',
            stdio: 'pipe',
          });

          const additions = (fileContent.match(/^\+(?!\+\+)/gm) || []).length;
          file.additions = additions;
          file.deletions = 0;
        } catch {
          // If not staged, try unstaged
          try {
            const lines = execSync(`wc -l "${file.path}"`, {
              cwd: resolvedPath,
              encoding: 'utf8',
              stdio: 'pipe',
            });
            file.additions = parseInt(lines.trim().split(' ')[0]) || 0;
            file.deletions = 0;
          } catch {
            file.additions = 0;
            file.deletions = 0;
          }
        }
      } else if (file.status === 'deleted') {
        // For deleted files, count total lines from HEAD
        try {
          const lines = execSync(`git show HEAD:"${file.path}" | wc -l`, {
            cwd: resolvedPath,
            encoding: 'utf8',
            stdio: 'pipe',
            shell: '/bin/bash',
          });
          file.additions = 0;
          file.deletions = parseInt(lines.trim()) || 0;
        } catch {
          file.additions = 0;
          file.deletions = 0;
        }
      } else {
        // For modified files, get actual diff stats
        try {
          const stats = execSync(`git diff --numstat HEAD -- "${file.path}"`, {
            cwd: resolvedPath,
            encoding: 'utf8',
            stdio: 'pipe',
          });

          const parts = stats.trim().split('\t');
          file.additions = parseInt(parts[0]) || 0;
          file.deletions = parseInt(parts[1]) || 0;
        } catch {
          file.additions = 0;
          file.deletions = 0;
        }
      }
    }

    const response: GitDiffResponse = {
      files,
      totalFiles: files.length,
      hasChanges: files.length > 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Git diff error:', error);
    return NextResponse.json(
      {
        files: [],
        totalFiles: 0,
        hasChanges: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as GitDiffResponse,
      { status: 500 }
    );
  }
}
