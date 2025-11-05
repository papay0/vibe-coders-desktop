import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

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
  const lines = statusOutput.split('\n');

  for (const line of lines) {
    // Skip empty lines
    if (!line || line.length < 3) continue;

    const statusCode = line.substring(0, 2);
    const filePath = line.substring(3).trim(); // Trim the filename only

    // Skip if no filename
    if (!filePath) continue;

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

    // Expand directories to show all files within
    const actualFiles: GitFileStatus[] = [];
    for (const file of files) {
      try {
        const fullPath = path.join(resolvedPath, file.path);

        // If path doesn't exist, it's a deleted file - keep it
        if (!fs.existsSync(fullPath)) {
          actualFiles.push(file);
          continue;
        }

        const stat = fs.statSync(fullPath);

        if (stat.isFile()) {
          // It's a file, keep it
          actualFiles.push(file);
        } else if (stat.isDirectory()) {
          // It's a directory, recursively find all files within
          const findFilesInDir = (dir: string, relativeTo: string): string[] => {
            const filesInDir: string[] = [];
            const entries = fs.readdirSync(dir, { withFileTypes: true });

            for (const entry of entries) {
              const entryPath = path.join(dir, entry.name);
              const relativeEntryPath = path.relative(relativeTo, entryPath);

              if (entry.isFile()) {
                filesInDir.push(relativeEntryPath);
              } else if (entry.isDirectory()) {
                filesInDir.push(...findFilesInDir(entryPath, relativeTo));
              }
            }

            return filesInDir;
          };

          const filesInDir = findFilesInDir(fullPath, resolvedPath);
          for (const filePath of filesInDir) {
            actualFiles.push({
              path: filePath,
              status: file.status, // Inherit status from parent directory
            });
          }
        }
      } catch (error) {
        // If we can't stat it, include it anyway (might be deleted file)
        actualFiles.push(file);
      }
    }

    // Get stats for all files using batch numstat
    try {
      const numstatOutput = execSync('git diff --numstat HEAD', {
        cwd: resolvedPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });

      const statsMap = new Map<string, { additions: number; deletions: number }>();
      const lines = numstatOutput.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const filePath = parts[2];
          statsMap.set(filePath, { additions, deletions });
        }
      }

      // Apply stats to all files
      for (const file of actualFiles) {
        if (file.status === 'deleted') {
          // Deleted files - count lines from HEAD
          try {
            const headContent = execSync(`git show HEAD:"${file.path}"`, {
              cwd: resolvedPath,
              encoding: 'utf8',
              stdio: 'pipe',
            });
            file.additions = 0;
            file.deletions = headContent.split('\n').length;
          } catch {
            file.additions = 0;
            file.deletions = 0;
          }
        } else if (file.status === 'untracked' || file.status === 'added') {
          // New files - count all lines
          try {
            const fullPath = path.join(resolvedPath, file.path);
            const content = fs.readFileSync(fullPath, 'utf8');
            file.additions = content.split('\n').length;
            file.deletions = 0;
          } catch {
            file.additions = 0;
            file.deletions = 0;
          }
        } else {
          // Modified files - get from statsMap
          const stats = statsMap.get(file.path);
          if (stats) {
            file.additions = stats.additions;
            file.deletions = stats.deletions;
          } else {
            // Fallback if not in map
            file.additions = 0;
            file.deletions = 0;
          }
        }
      }
    } catch (error) {
      console.error('Error getting git stats:', error);
      // Set all to 0 on error
      for (const file of actualFiles) {
        file.additions = 0;
        file.deletions = 0;
      }
    }

    const response: GitDiffResponse = {
      files: actualFiles,
      totalFiles: actualFiles.length,
      hasChanges: actualFiles.length > 0,
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
