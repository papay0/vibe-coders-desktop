import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

const execAsync = promisify(exec);

// Get the code-server info file path for a project
async function getCodeServerInfoPath(projectPath: string): Promise<string> {
  const hash = crypto.createHash('md5').update(projectPath).digest('hex');
  const serverDir = path.join(os.homedir(), '.vibe-coders', 'code-servers');
  return path.join(serverDir, `${hash}.json`);
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

    console.log('[stop-code-server] ========== STOP REQUEST ==========');
    console.log('[stop-code-server] Project path:', projectPath);

    // Try to read the saved code-server info
    const codeServerInfoPath = await getCodeServerInfoPath(projectPath);

    try {
      const fileContent = await readFile(codeServerInfoPath, 'utf-8');
      const serverInfo = JSON.parse(fileContent);
      console.log('[stop-code-server] Found code-server info:', serverInfo);

      // Kill the process
      try {
        await execAsync(`kill ${serverInfo.pid}`);
        console.log('[stop-code-server] ✅ Killed code-server process:', serverInfo.pid);

        // Wait for the process to actually die
        let retries = 10;
        while (retries > 0) {
          try {
            await execAsync(`ps -p ${serverInfo.pid}`);
            // Process still running, wait
            await new Promise(resolve => setTimeout(resolve, 500));
            retries--;
          } catch (error) {
            // Process is dead
            console.log('[stop-code-server] ✓ Process is dead:', serverInfo.pid);
            break;
          }
        }

        // Delete the info file
        await unlink(codeServerInfoPath);
        console.log('[stop-code-server] ✓ Removed code-server info file');

        return NextResponse.json({
          success: true,
          message: 'Code-server stopped successfully'
        });
      } catch (error: any) {
        console.error('[stop-code-server] Failed to kill process:', error);
        // Try to delete the stale info file anyway
        try {
          await unlink(codeServerInfoPath);
        } catch (e) {
          // Ignore
        }
        throw error;
      }
    } catch (error) {
      console.log('[stop-code-server] No code-server info file found or already stopped');
      return NextResponse.json({
        success: true,
        message: 'Code-server not running or already stopped'
      });
    }
  } catch (error: any) {
    console.error('[stop-code-server] Error:', error);
    return NextResponse.json(
      { error: 'Failed to stop code-server', details: error.message },
      { status: 500 }
    );
  }
}
