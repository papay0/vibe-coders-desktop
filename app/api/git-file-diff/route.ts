import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export const maxDuration = 30;

interface GitFileDiffResponse {
  oldContent: string;
  newContent: string;
  unifiedDiff: string;
  fileName: string;
  language: string;
  error?: string;
}

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'bash',
    '.yml': 'yaml',
    '.yaml': 'yaml',
  };
  return languageMap[ext] || 'text';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectPath, filePath } = body;

    if (!projectPath || !filePath) {
      return NextResponse.json(
        { error: 'Project path and file path are required' },
        { status: 400 }
      );
    }

    const resolvedProjectPath = path.resolve(projectPath);
    const fullFilePath = path.join(resolvedProjectPath, filePath);

    // Check if it's a git repository
    try {
      execSync('git rev-parse --git-dir', {
        cwd: resolvedProjectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Not a git repository' },
        { status: 400 }
      );
    }

    let oldContent = '';
    let newContent = '';
    let unifiedDiff = '';

    // Get the actual git diff output
    try {
      unifiedDiff = execSync(`git diff HEAD -- "${filePath}"`, {
        cwd: resolvedProjectPath,
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (error) {
      // If no diff from HEAD, might be untracked file
      try {
        unifiedDiff = execSync(`git diff --no-index /dev/null "${filePath}"`, {
          cwd: resolvedProjectPath,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch {
        unifiedDiff = '';
      }
    }

    // Check file status
    const statusOutput = execSync(`git status --porcelain -- "${filePath}"`, {
      cwd: resolvedProjectPath,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();

    const status = statusOutput.substring(0, 2);

    if (status.includes('D')) {
      // File was deleted - get old content from HEAD
      try {
        oldContent = execSync(`git show HEAD:"${filePath}"`, {
          cwd: resolvedProjectPath,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch {
        oldContent = '';
      }
      newContent = '';
    } else if (status.includes('A') || status.includes('??')) {
      // File was added or is untracked
      oldContent = '';
      if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).isFile()) {
        newContent = fs.readFileSync(fullFilePath, 'utf8');
      }
    } else {
      // File was modified - get both versions
      try {
        oldContent = execSync(`git show HEAD:"${filePath}"`, {
          cwd: resolvedProjectPath,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch {
        oldContent = '';
      }

      if (fs.existsSync(fullFilePath) && fs.statSync(fullFilePath).isFile()) {
        newContent = fs.readFileSync(fullFilePath, 'utf8');
      }
    }

    const response: GitFileDiffResponse = {
      oldContent,
      newContent,
      unifiedDiff,
      fileName: path.basename(filePath),
      language: detectLanguage(filePath),
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        oldContent: '',
        newContent: '',
        unifiedDiff: '',
        fileName: '',
        language: 'text',
        error: error instanceof Error ? error.message : 'Unknown error',
      } as GitFileDiffResponse,
      { status: 500 }
    );
  }
}
