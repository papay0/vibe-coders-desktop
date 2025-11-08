import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { getServerInfoPath } from '@/lib/server-info';

const execAsync = promisify(exec);

// Find an available port starting from 3000
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      // Check if port is in use
      await execAsync(`lsof -iTCP:${port} -sTCP:LISTEN -t`);
      // If we get here, port is in use, try next one
      console.log('[findAvailablePort] Port', port, 'is in use, trying next...');
    } catch (error) {
      // Port is available
      console.log('[findAvailablePort] ✅ Found available port:', port);
      return port;
    }
  }
  throw new Error('No available ports found in range');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { port, projectPath } = body;

    if (!projectPath) {
      return NextResponse.json(
        { error: 'Project path is required' },
        { status: 400 }
      );
    }

    console.log('[restart-server] ========== RESTART REQUEST ==========');
    console.log('[restart-server] Project path:', projectPath);
    console.log('[restart-server] Port from frontend:', port);

    // Step 1: Find and kill any running dev server for this project
    // Don't trust the port from frontend - find the actual server
    try {
      const lockFilePath = path.join(projectPath, '.next', 'dev', 'lock');
      console.log('[restart-server] Looking for lock file:', lockFilePath);

      const { stdout: lsofOutput } = await execAsync(
        `lsof "${lockFilePath}" 2>/dev/null | grep -v COMMAND || echo ""`
      );

      if (lsofOutput.trim()) {
        console.log('[restart-server] Found process with lock file');
        const lines = lsofOutput.trim().split('\n');

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const command = parts[0];
          const pid = parts[1];

          if (command.toLowerCase().includes('node')) {
            console.log('[restart-server] Killing node process:', pid);
            try {
              await execAsync(`kill ${pid}`);
              console.log('[restart-server] Sent kill signal to:', pid);

              // Wait for the process to actually die (up to 5 seconds)
              let retries = 10;
              while (retries > 0) {
                try {
                  await execAsync(`ps -p ${pid}`);
                  // Process still running, wait
                  await new Promise(resolve => setTimeout(resolve, 500));
                  retries--;
                } catch (error) {
                  // Process is dead
                  console.log('[restart-server] ✓ Process is dead:', pid);
                  break;
                }
              }

              if (retries === 0) {
                console.log('[restart-server] Warning: Process may still be running:', pid);
              }
            } catch (error) {
              console.log('[restart-server] Failed to kill process:', pid);
            }
          }
        }
      } else {
        console.log('[restart-server] No running server found to kill');
      }
    } catch (error) {
      console.log('[restart-server] Error finding/killing server:', error);
    }

    // Step 1.5: Clean up the lock file to be sure
    try {
      const lockFilePath = path.join(projectPath, '.next', 'dev', 'lock');
      await unlink(lockFilePath);
      console.log('[restart-server] ✓ Removed lock file');
    } catch (error) {
      console.log('[restart-server] No lock file to remove (or already gone)');
    }

    // Step 2: Find an available port (don't assume any port is ours!)
    console.log('[restart-server] Finding available port...');
    const availablePort = await findAvailablePort();

    console.log('[restart-server] Starting server on port:', availablePort);
    const { port: newPort, pid: newPid } = await startDevServer(projectPath, availablePort);

    // Save the server info
    const serverInfoPath = await getServerInfoPath(projectPath);
    await writeFile(
      serverInfoPath,
      JSON.stringify({ port: newPort, pid: newPid, startedAt: new Date().toISOString() }, null, 2)
    );
    console.log('[restart-server] Saved server info to:', serverInfoPath);

    return NextResponse.json({
      success: true,
      port: newPort,
    });
  } catch (error: any) {
    console.error('[restart-server] Error:', error);
    return NextResponse.json(
      { error: 'Failed to restart server', details: error.message },
      { status: 500 }
    );
  }
}

function startDevServer(projectPath: string, port: number): Promise<{ port: number; pid: number }> {
  return new Promise((resolve, reject) => {
    console.log('[startDevServer] Spawning npm run dev on port', port);

    // Spawn npm run dev in the project directory with PORT env variable
    const child = spawn('npm', ['run', 'dev'], {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });

    const pid = child.pid!;
    console.log('[restart-server] Process spawned with PID:', pid);

    let portFound = false;
    const timeout = setTimeout(() => {
      if (!portFound) {
        child.kill();
        reject(new Error('Timeout waiting for server to start'));
      }
    }, 60000); // 60 second timeout

    // Listen to stdout for localhost URL
    child.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[restart-server] stdout:', output);

      // Look for localhost:XXXX pattern
      const urlMatch = output.match(/https?:\/\/localhost:(\d+)/);
      if (urlMatch && !portFound) {
        portFound = true;
        clearTimeout(timeout);
        const port = parseInt(urlMatch[1], 10);
        console.log('[restart-server] Server started on port:', port);

        // Unref so the process runs in background
        child.unref();

        resolve({ port, pid });
      }
    });

    // Listen to stderr as well (some servers log to stderr)
    child.stderr?.on('data', (data) => {
      const output = data.toString();
      console.log('[restart-server] stderr:', output);

      const urlMatch = output.match(/https?:\/\/localhost:(\d+)/);
      if (urlMatch && !portFound) {
        portFound = true;
        clearTimeout(timeout);
        const port = parseInt(urlMatch[1], 10);
        console.log('[restart-server] Server started on port:', port);

        child.unref();

        resolve({ port, pid });
      }
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[restart-server] Process error:', error);
      reject(error);
    });

    child.on('exit', (code) => {
      if (!portFound) {
        clearTimeout(timeout);
        console.error('[restart-server] Process exited with code:', code);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}
