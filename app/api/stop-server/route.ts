import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

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

    console.log('[stop-server] ========== STOP REQUEST ==========');
    console.log('[stop-server] Project path:', projectPath);

    // Find and kill any running dev server for this project
    try {
      const lockFilePath = path.join(projectPath, '.next', 'dev', 'lock');
      console.log('[stop-server] Looking for lock file:', lockFilePath);

      const { stdout: lsofOutput } = await execAsync(
        `lsof "${lockFilePath}" 2>/dev/null | grep -v COMMAND || echo ""`
      );

      if (lsofOutput.trim()) {
        console.log('[stop-server] Found process with lock file');
        const lines = lsofOutput.trim().split('\n');

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const command = parts[0];
          const pid = parts[1];

          if (command.toLowerCase().includes('node')) {
            console.log('[stop-server] Killing node process:', pid);
            try {
              await execAsync(`kill ${pid}`);
              console.log('[stop-server] Sent kill signal to:', pid);

              // Wait for the process to actually die
              let retries = 10;
              while (retries > 0) {
                try {
                  await execAsync(`ps -p ${pid}`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  retries--;
                } catch (error) {
                  console.log('[stop-server] ✓ Process stopped:', pid);
                  break;
                }
              }
            } catch (error) {
              console.log('[stop-server] Error killing process:', pid);
            }
          }
        }
      } else {
        console.log('[stop-server] No running server found');
      }

      // Clean up lock file
      try {
        await unlink(lockFilePath);
        console.log('[stop-server] ✓ Removed lock file');
      } catch (error) {
        console.log('[stop-server] No lock file to remove');
      }

      console.log('[stop-server] ========== SERVER STOPPED ==========');
      return NextResponse.json({
        success: true,
        message: 'Server stopped successfully',
      });
    } catch (error: any) {
      console.error('[stop-server] Error:', error);
      return NextResponse.json(
        { error: 'Failed to stop server', details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[stop-server] Error:', error);
    return NextResponse.json(
      { error: 'Failed to stop server', details: error.message },
      { status: 500 }
    );
  }
}
