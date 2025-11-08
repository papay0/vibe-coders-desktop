import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import path from 'path';
import { getServerInfoPath } from '@/lib/server-info';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectPath = searchParams.get('path');

    console.log('[check-server-status] Request received');
    console.log('[check-server-status] Project path:', projectPath);

    if (!projectPath) {
      console.log('[check-server-status] ERROR: No project path provided');
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    // Step 1: Check for saved server info file
    const serverInfoPath = await getServerInfoPath(projectPath);
    console.log('[check-server-status] Looking for server info file:', serverInfoPath);

    try {
      const fileContent = await readFile(serverInfoPath, 'utf-8');
      const serverInfo = JSON.parse(fileContent);
      console.log('[check-server-status] Found server info:', serverInfo);

      // Verify the PID is still running
      try {
        const { stdout } = await execAsync(`ps -p ${serverInfo.pid} -o command=`);
        console.log('[check-server-status] Process is running:', stdout.trim());

        // Verify the port is still listening
        const portCheck = await execAsync(`lsof -iTCP:${serverInfo.port} -sTCP:LISTEN -t`);
        if (portCheck.stdout.trim()) {
          console.log('[check-server-status] ✅ Server verified - port', serverInfo.port, 'is listening');

          return NextResponse.json({
            running: true,
            port: serverInfo.port,
            healthy: true,
          });
        }
      } catch (error) {
        console.log('[check-server-status] Saved PID/port no longer valid:', error);
      }
    } catch (error) {
      console.log('[check-server-status] No server info file found, will try detection');
    }

    // Step 2: Fallback - Find Next.js dev server by looking for .next/dev files
    console.log('[check-server-status] Attempting Next.js dev server detection...');

    try {
      // Find node processes that have .next/dev/lock or .next/dev/trace file open
      // This is very specific to Next.js dev servers
      const lockFilePath = path.join(projectPath, '.next', 'dev', 'lock');
      console.log('[check-server-status] Looking for processes with lock file:', lockFilePath);

      const { stdout: lsofOutput } = await execAsync(
        `lsof "${lockFilePath}" 2>/dev/null | grep -v COMMAND || echo ""`
      );

      if (!lsofOutput.trim()) {
        console.log('[check-server-status] No process has .next/dev/lock open - server not running');
        return NextResponse.json({
          running: false,
          port: null,
        });
      }

      console.log('[check-server-status] Found process(es) with lock file open');
      const lines = lsofOutput.trim().split('\n');

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const command = parts[0];
        const pid = parts[1];

        // Only check node processes
        if (!command.toLowerCase().includes('node')) {
          console.log('[check-server-status] Skipping non-node process:', command);
          continue;
        }

        console.log('[check-server-status] Found node process with lock file, PID:', pid);

        // Check what port this process is listening on
        // IMPORTANT: Only look at lines for this specific PID
        try {
          const { stdout: portOutput } = await execAsync(`lsof -p ${pid} -iTCP -sTCP:LISTEN -P -n 2>/dev/null`);

          if (portOutput.trim()) {
            console.log('[check-server-status] Port output for PID', pid);

            // Split into lines and find the one matching our PID
            const lines = portOutput.split('\n');
            for (const line of lines) {
              // Check if this line is for our PID (not header, and matches PID in column 2)
              const parts = line.trim().split(/\s+/);
              if (parts.length > 1 && parts[1] === pid) {
                const portMatch = line.match(/:(\d+)\s+\(LISTEN\)/);
                if (portMatch) {
                  const port = parseInt(portMatch[1], 10);
                  console.log('[check-server-status] ✅ Found Next.js dev server on port:', port);

                  return NextResponse.json({
                    running: true,
                    port,
                    healthy: true,
                  });
                }
              }
            }
            console.log('[check-server-status] No listening port found for PID:', pid);
          } else {
            console.log('[check-server-status] Process not listening on any port yet');
          }
        } catch (error) {
          console.log('[check-server-status] Could not check port for PID:', pid);
          continue;
        }
      }

      console.log('[check-server-status] Found lock file but no listening port');
      return NextResponse.json({
        running: false,
        port: null,
      });
    } catch (error: any) {
      console.log('[check-server-status] Detection failed:', error.message);
      return NextResponse.json({
        running: false,
        port: null,
      });
    }
  } catch (error: any) {
    console.error('[check-server-status] Error checking server status:', error);
    return NextResponse.json(
      { error: 'Failed to check server status', details: error.message },
      { status: 500 }
    );
  }
}
