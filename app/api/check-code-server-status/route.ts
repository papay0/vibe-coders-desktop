import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectPath = searchParams.get('path');

    console.log('[check-code-server-status] Request received');
    console.log('[check-code-server-status] Project path:', projectPath);

    if (!projectPath) {
      console.log('[check-code-server-status] ERROR: No project path provided');
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    // Check for saved code-server info file
    const codeServerInfoPath = await getCodeServerInfoPath(projectPath);
    console.log('[check-code-server-status] Looking for code-server info file:', codeServerInfoPath);

    try {
      const fileContent = await readFile(codeServerInfoPath, 'utf-8');
      const serverInfo = JSON.parse(fileContent);
      console.log('[check-code-server-status] Found code-server info:', serverInfo);

      // Verify the PID is still running
      try {
        const { stdout } = await execAsync(`ps -p ${serverInfo.pid} -o command=`);
        console.log('[check-code-server-status] Process is running:', stdout.trim());

        // Verify the port is still listening
        const portCheck = await execAsync(`lsof -iTCP:${serverInfo.port} -sTCP:LISTEN -t`);
        if (portCheck.stdout.trim()) {
          console.log('[check-code-server-status] ✅ Code-server verified - port', serverInfo.port, 'is listening');

          return NextResponse.json({
            running: true,
            port: serverInfo.port,
            pid: serverInfo.pid,
          });
        }
      } catch (error) {
        console.log('[check-code-server-status] Saved PID/port no longer valid:', error);
      }
    } catch (error) {
      console.log('[check-code-server-status] No code-server info file found');
    }

    // Code-server not running
    console.log('[check-code-server-status] Code-server not running');
    return NextResponse.json({
      running: false,
      port: null,
    });
  } catch (error: any) {
    console.error('[check-code-server-status] Error checking code-server status:', error);
    return NextResponse.json(
      { error: 'Failed to check code-server status', details: error.message },
      { status: 500 }
    );
  }
}
